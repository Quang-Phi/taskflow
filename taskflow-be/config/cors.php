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

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth', 'callback', 'auth/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins,
    // Allow any ngrok tunnel or local dev origin dynamically
    'allowed_origins_patterns' => [
        '#^https?://.*\.ngrok(-free)?\.app$#',
        '#^https?://.*\.ngrok\.io$#',
        '#^http://localhost:\d+$#',
        '#^http://127\.0\.0\.1:\d+$#',
        '#^http://10\.\d+\.\d+\.\d+:\d+$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => true,
];
