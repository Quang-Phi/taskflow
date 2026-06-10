<?php

return [
    'url' => env('BITRIX_URL', 'https://bitrix.esuhai.org'),
    'client_id' => env('BITRIX_CLIENT_ID', ''),
    'client_secret' => env('BITRIX_CLIENT_SECRET', ''),
    'super_admin_id' => (int) env('BITRIX_SUPER_ADMIN_ID', 632),
];
