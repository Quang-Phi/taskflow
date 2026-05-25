<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BitrixService
{
    protected string $baseUrl;
    protected ?string $accessToken = null;

    public function __construct()
    {
        $this->baseUrl = config('bitrix.url');
    }

    /**
     * Set access token for API calls (from authenticated user).
     */
    public function setAccessToken(string $token): self
    {
        $this->accessToken = $token;
        return $this;
    }

    /**
     * Refresh Bitrix access token using refresh_token.
     */
    public function refreshToken(User $user): ?string
    {
        if (!$user->bitrix_refresh_token) {
            return null;
        }

        $domain = $user->bitrix_domain ?: 'oauth.bitrix.info';
        $oauthUrl = str_starts_with($domain, 'http') ? $domain : "https://{$domain}";
        $oauthUrl = rtrim($oauthUrl, '/') . '/oauth/token/';

        try {
            $response = Http::timeout(10)->get($oauthUrl, [
                'grant_type' => 'refresh_token',
                'client_id' => config('bitrix.client_id'),
                'client_secret' => config('bitrix.client_secret'),
                'refresh_token' => $user->bitrix_refresh_token,
            ]);

            $data = $response->json();
        } catch (\Exception $e) {
            Log::error('BitrixService: Token refresh connection failed', [
                'url' => $oauthUrl,
                'error' => $e->getMessage(),
            ]);
            // Fallback to the existing token instead of throwing 401 on transient network errors
            return $user->bitrix_access_token;
        }

        if (!$data || !isset($data['access_token'])) {
            Log::error('BitrixService: Token refresh failed', [
                'url' => $oauthUrl,
                'status' => isset($response) ? $response->status() : 'unknown',
                'body' => isset($response) ? substr($response->body(), 0, 500) : 'none',
            ]);
            return null;
        }

        // Update user tokens
        $user->update([
            'bitrix_access_token' => $data['access_token'],
            'bitrix_refresh_token' => $data['refresh_token'] ?? $user->bitrix_refresh_token,
            'bitrix_token_expires' => now()->addSeconds($data['expires_in'] ?? 3600),
        ]);

        $this->accessToken = $data['access_token'];
        return $data['access_token'];
    }

    /**
     * Ensure we have a valid access token, refresh if expired.
     */
    public function ensureValidToken(User $user): ?string
    {
        if (!$user->isBitrixTokenExpired() && $user->bitrix_access_token) {
            $this->accessToken = $user->bitrix_access_token;
            return $this->accessToken;
        }

        return $this->refreshToken($user);
    }

    /**
     * Call Bitrix REST API with access_token.
     */
    protected function callApi(string $endpoint, array $params = [], string $method = 'GET')
    {
        $url = $this->baseUrl . $endpoint;
        $params['auth'] = $this->accessToken;

        $http = Http::timeout(15);

        return $method === 'POST'
            ? $http->post($url, $params)
            : $http->get($url, $params);
    }

    /**
     * Call any custom Bitrix URL with access token (e.g. /cv/api/...).
     */
    public function callCustomApi(string $fullPath, array $params = [])
    {
        $url = $this->baseUrl . $fullPath;
        $params['auth'] = $this->accessToken;

        return Http::timeout(15)->get($url, $params);
    }

    /**
     * Get current user from Bitrix (used during OAuth callback).
     */
    public function getCurrentUser(?string $accessToken = null): ?array
    {
        $token = $accessToken ?? $this->accessToken;

        $response = Http::timeout(10)->get($this->baseUrl . '/rest/user.current.json', [
            'auth' => $token,
        ]);

        $data = $response->json();

        if (!$data || !isset($data['result'])) {
            return null;
        }

        return $data['result'];
    }

    /**
     * Get list of all users.
     */
    public function getUsers(array $filters = []): array
    {
        $allUsers = [];
        $start = 0;

        do {
            $response = $this->callApi('/rest/user.get.json', array_merge([
                'start' => $start,
            ], $filters));

            $data = $response->json();

            if (!$data || !isset($data['result'])) {
                Log::error('BitrixService: Failed to fetch users at start ' . $start, [
                    'status' => $response->status(),
                ]);
                break;
            }

            $allUsers = array_merge($allUsers, $data['result']);
            $start = $data['next'] ?? null;
        } while ($start);

        return $allUsers;
    }

    /**
     * Get a specific user by Bitrix ID.
     */
    public function getUserById(int $userId): ?array
    {
        $response = $this->callApi('/rest/user.get.json', [
            'ID' => $userId,
        ]);

        $data = $response->json();

        return ($data && isset($data['result'][0])) ? $data['result'][0] : null;
    }

    /**
     * Get list of all departments.
     */
    public function getDepartments(): array
    {
        $allDepts = [];
        $start = 0;

        do {
            $response = $this->callApi('/rest/department.get.json', [
                'start' => $start,
            ]);

            $data = $response->json();

            if (!$data || !isset($data['result'])) {
                Log::error('BitrixService: Failed to fetch departments at start ' . $start);
                break;
            }

            $allDepts = array_merge($allDepts, $data['result']);
            $start = $data['next'] ?? null;
        } while ($start);

        return $allDepts;
    }
}
