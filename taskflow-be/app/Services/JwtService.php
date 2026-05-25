<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtService
{
    /**
     * Generate a JWT token for a Bitrix user.
     */
    public function generateToken(array $userData): string
    {
        $now = time();
        $ttl = config('jwt.ttl', 480);

        $payload = [
            'iss' => config('app.url'),
            'iat' => $now,
            'exp' => $now + ($ttl * 60),
            'sub' => $userData['ID'] ?? null,
            'data' => [
                'bitrix_id' => $userData['ID'] ?? null,
                'name' => trim(($userData['NAME'] ?? '') . ' ' . ($userData['LAST_NAME'] ?? '')),
                'email' => $userData['EMAIL'] ?? '',
                'department' => $userData['UF_DEPARTMENT'] ?? [],
                'active' => $userData['ACTIVE'] ?? 'Y',
            ],
        ];

        return JWT::encode($payload, config('jwt.secret'), config('jwt.algo'));
    }

    /**
     * Decode and validate a JWT token.
     */
    public function decodeToken(string $token): ?object
    {
        try {
            return JWT::decode($token, new Key(config('jwt.secret'), config('jwt.algo')));
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Refresh a token if it's close to expiring (within 30 min).
     */
    public function refreshIfNeeded(string $token): ?string
    {
        $decoded = $this->decodeToken($token);
        if (!$decoded) return null;

        $remaining = $decoded->exp - time();
        if ($remaining < 1800 && $remaining > 0) {
            // Rebuild payload with fresh exp
            $data = (array) $decoded->data;
            return $this->generateToken([
                'ID' => $data['bitrix_id'],
                'NAME' => explode(' ', $data['name'])[0] ?? '',
                'LAST_NAME' => explode(' ', $data['name'])[1] ?? '',
                'EMAIL' => $data['email'],
                'UF_DEPARTMENT' => $data['department'],
                'ACTIVE' => $data['active'],
            ]);
        }

        return null; // No refresh needed
    }
}
