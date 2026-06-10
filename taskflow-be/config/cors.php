<?php

$frontendUrls = env('FRONTEND_URL', 'http://localhost:3000');
$origins = [];
foreach (explode(',', $frontendUrls) as $url) {
    $url = trim($url);
    if (empty($url)) {
        continue;
    }
    $origins[] = $url;
    if (!str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
        $origins[] = 'https://' . $url;
        $origins[] = 'http://' . $url;
    }
}

// FIX: Removed wildcard ngrok patterns (*.ngrok-free.app, *.ngrok.io).
// Combining wildcard origin patterns with supports_credentials:true is a Critical CORS misconfiguration.
// Any free ngrok subdomain could make credentialed cross-origin requests to the API.
// For development with ngrok: add your specific ngrok URL to FRONTEND_URL in .env instead.
$allowedPatterns = [
    '#^http://localhost:\d+$#',
    '#^http://127\.0\.0\.1:\d+$#',
];

// Allow specific private IP ranges only in non-production environments
if (env('APP_ENV', 'production') !== 'production') {
    $allowedPatterns[] = '#^http://10\.\d+\.\d+\.\d+:\d+$#';
    $allowedPatterns[] = '#^http://192\.168\.\d+\.\d+:\d+$#';
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth', 'callback', 'auth/*', 'storage/*', 'public/storage/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $origins,
    'allowed_origins_patterns' => $allowedPatterns,
    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Language'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => true,
];
