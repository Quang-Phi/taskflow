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
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
