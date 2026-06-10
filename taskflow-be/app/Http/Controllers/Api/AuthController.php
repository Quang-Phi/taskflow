<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\BitrixService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    protected BitrixService $bitrix;

    public function __construct(BitrixService $bitrix)
    {
        $this->bitrix = $bitrix;
    }

    /**
     * Step 1: Redirect user to Bitrix OAuth2 authorization page.
     */
    public function redirect(Request $request)
    {
        $origin = $request->query('origin');
        if (!$origin) {
            $referer = $request->headers->get('referer');
            if ($referer) {
                $parsed = parse_url($referer);
                if (isset($parsed['scheme']) && isset($parsed['host'])) {
                    $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
                    $origin = $parsed['scheme'] . '://' . $parsed['host'] . $port;
                }
            }
        }
        if (!$origin) {
            $host = $request->getHost();
            $origin = "http://{$host}:3000";
        }

        $authUrl = config('bitrix.url') . '/oauth/authorize/?' . http_build_query([
            'client_id' => config('bitrix.client_id'),
            'response_type' => 'code',
            'state' => $origin,
        ]);

        return redirect()->away($authUrl);
    }

    /**
     * Bitrix Local App Handler / OAuth2 Callback.
     *
     * Supports multiple flows:
     * A) GET ?code=xxx → exchange for token via oauth.bitrix.info
     * B) POST AUTH_ID from Bitrix local app
     * C) GET with AJAX from embedded JS page
     */
    public function callback(Request $request)
    {
        // === Flow A: Authorization Code → exchange via oauth.bitrix.info or local ===
        if ($request->has('code')) {
            return $this->handleAuthorizationCode($request);
        }

        // === Flow B: POST from Bitrix local app handler (AUTH_ID) ===
        $authId = $request->input('AUTH_ID') ?? $request->input('auth_id');
        if ($authId) {
            return $this->handleLocalApp($request);
        }

        // === Flow C: Show handler page (Bitrix embeds this as iframe) ===
        return $this->showHandlerPage();
    }

    /**
     * Show the Bitrix handler page that extracts auth params from JS.
     * Bitrix loads this page in an iframe and passes placement info.
     */
    private function showHandlerPage()
    {
        // FIX #4: postMessage target origin set to configured FRONTEND_URL instead of wildcard '*'
        $allowedOrigin = rtrim(explode(',', env('FRONTEND_URL', 'http://localhost:3000'))[0], '/');
        $nonce = base64_encode(random_bytes(16));

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <title>TaskFlow - Bitrix Auth</title>
    <script src="https://api.bitrix24.com/api/v1/"></script>
</head>
<body>
    <div id="status">Authenticating with Bitrix24...</div>
    <script nonce="{$nonce}">
        var ALLOWED_PARENT_ORIGIN = '{$allowedOrigin}';

        BX24.init(function() {
            var auth = BX24.getAuth();

            if (auth && auth.access_token) {
                document.getElementById('status').innerText = 'Got token, logging in...';

                fetch('/api/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        AUTH_ID: auth.access_token,
                        REFRESH_ID: auth.refresh_token,
                        AUTH_EXPIRES: auth.expires_in,
                        DOMAIN: auth.domain,
                        member_id: auth.member_id || ''
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('status').innerText = 'Welcome, ' + data.user.name + '!';
                        if (window.parent !== window) {
                            // FIX #4: Use specific parent origin, NOT wildcard '*'
                            window.parent.postMessage({
                                type: 'TASKFLOW_AUTH',
                                token: data.token,
                                user: data.user
                            }, ALLOWED_PARENT_ORIGIN);
                        } else {
                            localStorage.setItem('taskflow_token', data.token);
                            window.location.href = '/';
                        }
                    } else {
                        document.getElementById('status').innerText = 'Auth failed: ' + data.message;
                    }
                })
                .catch(err => {
                    document.getElementById('status').innerText = 'Error: ' + err.message;
                });
            } else {
                document.getElementById('status').innerText = 'No auth data from Bitrix. Please open this app from Bitrix24.';
            }
        });
    </script>
</body>
</html>
HTML;

        return response($html)
            ->header('Content-Type', 'text/html')
            ->header('Content-Security-Policy', "script-src 'nonce-{$nonce}' https://api.bitrix24.com; default-src 'none'");
    }

    /**
     * Handle authorization code – try exchange via oauth.bitrix.info (cloud)
     * or via local Bitrix server.
     */
    private function handleAuthorizationCode(Request $request)
    {
        $code = $request->input('code');

        $bitrixUrl = config('bitrix.url', 'https://bitrix.esuhai.org');
        $parsedUrl = parse_url($bitrixUrl);
        $defaultDomain = $parsedUrl['host'] ?? 'oauth.bitrix.info';

        // FIX #3: Validate server_domain against whitelist — prevent credential exfiltration
        $requestedDomain = $request->input('server_domain', $defaultDomain);
        $serverDomain = $this->isAllowedBitrixDomain($requestedDomain) ? $requestedDomain : $defaultDomain;

        $domain = $request->input('domain');
        $memberId = $request->input('member_id');

        $tokenUrl = "https://{$serverDomain}/oauth/token/";

        $response = Http::get($tokenUrl, [
            'grant_type'    => 'authorization_code',
            'client_id'     => config('bitrix.client_id'),
            'client_secret' => config('bitrix.client_secret'),
            'code'          => $code,
        ]);

        $data = $response->json();
        // FIX: Log only status, never log raw tokens
        Log::info('Bitrix OAuth token exchange', [
            'domain'     => $serverDomain,
            'status'     => $response->status(),
            'has_token'  => isset($data['access_token']),
        ]);

        if ($data && isset($data['access_token'])) {
            // FIX #4: Validate state/redirectUrl against allowed frontend origins
            $state = $request->input('state');
            $defaultFrontend = explode(',', env('FRONTEND_URL', 'http://localhost:3000'))[0];
            $redirectUrl = ($state && $this->isAllowedRedirectOrigin($state)) ? $state : $defaultFrontend;

            return $this->createUserAndToken(
                accessToken:  $data['access_token'],
                refreshToken: $data['refresh_token'] ?? null,
                expiresIn:    $data['expires_in'] ?? 3600,
                domain:       $data['domain'] ?? $domain,
                memberId:     $data['member_id'] ?? $memberId,
                redirectUrl:  $redirectUrl
            );
        }

        // FIX: Return generic error — do NOT expose internal URL or Bitrix raw response
        Log::warning('Bitrix OAuth token exchange failed', [
            'domain' => $serverDomain,
            'status' => $response->status(),
        ]);
        return response()->json([
            'success' => false,
            'message' => 'Authentication failed. Please try again or open the app from Bitrix24.',
        ], 401);
    }

    /**
     * Handle Bitrix local app POST (AUTH_ID directly).
     */
    private function handleLocalApp(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        return $this->createUserAndToken(
            accessToken: $request->input('AUTH_ID') ?? $request->input('auth_id'),
            refreshToken: $request->input('REFRESH_ID') ?? $request->input('refresh_id'),
            expiresIn: (int) ($request->input('AUTH_EXPIRES') ?? $request->input('auth_expires') ?? 3600),
            domain: $request->input('DOMAIN') ?? $request->input('domain'),
            memberId: $request->input('member_id'),
        );
    }

    /**
     * Core: validate access_token → create/update User → Sanctum token.
     */
    private function createUserAndToken(
        string $accessToken,
        ?string $refreshToken,
        int $expiresIn,
        ?string $domain,
        ?string $memberId,
        ?string $redirectUrl = null
    ): \Symfony\Component\HttpFoundation\Response {
        $bitrixUser = $this->bitrix->getCurrentUser($accessToken);

        if (!$bitrixUser) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot validate Bitrix access token',
            ], 401);
        }

        $existingUser = User::find($bitrixUser['ID']);

        // FIX #1: Removed email-based admin escalation (str_contains 'admin' and hardcoded emails).
        // FIX #2 (partial): Hardcoded user ID 632 is also removed here.
        // Role logic: preserve existing DB role first, then check Bitrix dept head status.
        // Superadmin/admin roles can ONLY be assigned manually through DB or seeder.
        $role = 'employee';
        if ($existingUser && in_array($existingUser->role, ['superadmin', 'admin'], true)) {
            // Preserve existing privileged role — never downgrade on login
            $role = $existingUser->role;
        } elseif ($existingUser && $existingUser->role === 'manager') {
            // Preserve manager role assigned in DB
            $role = 'manager';
        } else {
            // Auto-detect manager from Bitrix department head
            try {
                $departments = $this->bitrix->getDepartments();
                foreach ($departments as $dept) {
                    $headId = $dept['UF_HEAD'] ?? null;
                    if ($headId && (int)$headId === (int)$bitrixUser['ID']) {
                        $role = 'manager';
                        break;
                    }
                }
            } catch (\Exception $e) {
                $role = $existingUser ? ($existingUser->role ?? 'employee') : 'employee';
            }
        }

        $user = User::updateOrCreate(
            ['id' => $bitrixUser['ID']],
            [
                'bitrix_id' => $bitrixUser['ID'],
                'name' => trim(($bitrixUser['LAST_NAME'] ?? '') . ' ' . ($bitrixUser['NAME'] ?? '')),
                'first_name' => $bitrixUser['NAME'] ?? '',
                'last_name' => $bitrixUser['LAST_NAME'] ?? '',
                'email' => $bitrixUser['EMAIL'] ?? '',
                'phone' => $bitrixUser['PERSONAL_MOBILE'] ?? $bitrixUser['PERSONAL_PHONE'] ?? '',
                'photo' => $bitrixUser['PERSONAL_PHOTO'] ?? null,
                'department_ids' => $bitrixUser['UF_DEPARTMENT'] ?? [],
                'work_position' => $bitrixUser['WORK_POSITION'] ?? '',
                'active' => in_array($bitrixUser['ACTIVE'] ?? 'Y', ['Y', 1, '1', true], true),
                'bitrix_access_token' => $accessToken,
                'bitrix_refresh_token' => $refreshToken,
                'bitrix_token_expires' => now()->addSeconds($expiresIn),
                'bitrix_domain' => $domain,
                'bitrix_member_id' => $memberId,
                'role' => $role,
            ]
        );

        $user->tokens()->delete();
        $sanctumToken = $user->createToken('taskflow-session', ['*'], now()->addDays(30));

        // Sync all users in the background/inline to ensure assignee/member lists are populated
        try {
            \App\Jobs\SyncBitrixUsersJob::dispatch($accessToken);
        } catch (\Exception $e) {
            Log::error('Bitrix user sync dispatch on login failed: ' . $e->getMessage());
        }

        if ($redirectUrl) {
            // FIX #4: Never pass Sanctum token in URL (browser history/log leakage).
            // Instead, issue a short-lived one-time code (TTL: 60s) stored in cache.
            // The frontend exchanges this code for the actual token via POST.
            $redirectUrl = rtrim($redirectUrl, '/');
            $oneTimeCode = Str::random(64);
            Cache::put('auth_code:' . $oneTimeCode, [
                'token'   => $sanctumToken->plainTextToken,
                'user_id' => $user->id,
            ], now()->addSeconds(60));
            return redirect()->away($redirectUrl . '/?code=' . $oneTimeCode);
        }

        return response()->json([
            'success' => true,
            'token' => $sanctumToken->plainTextToken,
            'user' => [
                'id' => $user->id,
                'bitrix_id' => $user->bitrix_id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo' => $user->photo,
                'department_ids' => $user->department_ids,
                'work_position' => $user->work_position,
                'role' => $user->role,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }

    /**
     * POST /api/auth/exchange
     * Exchange a short-lived one-time code (from OAuth redirect URL) for a Sanctum token.
     * The code is stored in cache for 60 seconds only.
     */
    public function exchangeCode(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string|size:64']);
        $code = $request->input('code');
        $cacheKey = 'auth_code:' . $code;
        $payload = Cache::pull($cacheKey); // pull = get + delete (one-time use)

        if (!$payload) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired authentication code.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'token'   => $payload['token'],
        ]);
    }

    /**
     * Check if a domain is an allowed Bitrix server domain.
     * Prevents SSRF / credential exfiltration via server_domain parameter.
     */
    private function isAllowedBitrixDomain(string $domain): bool
    {
        $bitrixUrl = config('bitrix.url', '');
        $parsedDefault = parse_url($bitrixUrl);
        $defaultHost = $parsedDefault['host'] ?? '';

        $allowedHosts = array_filter([
            $defaultHost,
            'oauth.bitrix.info',
            env('BITRIX_ALLOWED_DOMAIN', ''),
        ]);

        return in_array($domain, $allowedHosts, true);
    }

    /**
     * Check if a redirect URL belongs to an allowed frontend origin.
     * Prevents Open Redirect attacks via the 'state' / 'origin' parameter.
     */
    private function isAllowedRedirectOrigin(string $url): bool
    {
        $allowedUrls = explode(',', env('FRONTEND_URL', 'http://localhost:3000'));
        $parsedInput = parse_url(trim($url));
        $inputHost = ($parsedInput['scheme'] ?? '') . '://' . ($parsedInput['host'] ?? '');
        if (!empty($parsedInput['port'])) {
            $inputHost .= ':' . $parsedInput['port'];
        }

        foreach ($allowedUrls as $allowed) {
            $parsedAllowed = parse_url(trim($allowed));
            $allowedHost = ($parsedAllowed['scheme'] ?? '') . '://' . ($parsedAllowed['host'] ?? '');
            if (!empty($parsedAllowed['port'])) {
                $allowedHost .= ':' . $parsedAllowed['port'];
            }
            if ($inputHost === $allowedHost) {
                return true;
            }
        }

        return false;
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'bitrix_id' => $user->bitrix_id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo' => $user->photo,
                'department_ids' => $user->department_ids,
                'work_position' => $user->work_position,
                'role' => $user->role,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['success' => true, 'message' => 'Logged out']);
    }

    /**
     * GET /api/users
     * List all local users from the DB (for assignee dropdowns, member lists, etc.)
     */
    public function listUsers(Request $request): JsonResponse
    {
        $search = trim($request->input('search'));
        $search = preg_replace('/\s+/', ' ', $search);

        $query = User::query()->orderBy('name');

        // Only return active users
        $query->where('active', true);

        $currentUser = $request->user();
        if ($currentUser) {
            if ($currentUser->role === 'employee') {
                $query->where('id', $currentUser->id);
            } elseif ($currentUser->role === 'manager') {
                if ($request->input('scope') === 'managed') {
                    $managedIds = $currentUser->getManagedUserIds();
                    $query->whereIn('id', $managedIds);
                }
            }
        }

        if (!empty($search)) {
            $likePattern = '%' . str_replace(' ', '%', $search) . '%';
            $query->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(email) LIKE ?', [$likePattern]);
            });
        }

        $users = $query->get(['id', 'name', 'email', 'photo', 'work_position', 'role', 'department_ids']);

        // Auto-sync fallback: If the database is missing managed users, trigger an on-the-fly sync.
        // We only trigger if the user count is <= 1 AND there is no search query (to avoid syncing on empty search results).
        if ($users->count() <= 1 && empty($search) && $currentUser && in_array($currentUser->role, ['manager', 'admin'])) {
            try {
                $token = $this->bitrix->ensureValidToken($currentUser);
                if ($token) {
                    $this->bitrix->syncUsers();
                    // Re-run the query
                    $users = $query->get(['id', 'name', 'email', 'photo', 'work_position', 'role', 'department_ids']);
                }
            } catch (\Exception $e) {
                Log::error('Auto-sync in listUsers failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * PUT /api/auth/settings
     * Save user preferences (theme, timezone, language, workspace_name, notification_settings)
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'theme' => 'sometimes|string|in:light,dark,system',
            'timezone' => 'sometimes|string|max:255',
            'language' => 'sometimes|string|in:vi,en,ja',
            'workspace_name' => 'sometimes|string|max:255',
            'notification_settings' => 'sometimes|array',
        ]);

        $user->update($request->only([
            'theme',
            'timezone',
            'language',
            'workspace_name',
            'notification_settings',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ]
        ]);
    }
}
