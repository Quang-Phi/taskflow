<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Services\JwtService;

class JwtAuth
{
    protected JwtService $jwtService;

    public function __construct(JwtService $jwtService)
    {
        $this->jwtService = $jwtService;
    }

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token not provided',
            ], 401);
        }

        $decoded = $this->jwtService->decodeToken($token);

        if (!$decoded) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired token',
            ], 401);
        }

        // Attach user data to request
        $request->merge([
            'jwt_user' => (array) $decoded->data,
            'jwt_user_id' => $decoded->sub,
        ]);

        $response = $next($request);

        // Auto-refresh token if close to expiry
        $refreshedToken = $this->jwtService->refreshIfNeeded($token);
        if ($refreshedToken) {
            $response->headers->set('X-Token-Refreshed', $refreshedToken);
        }

        return $response;
    }
}
