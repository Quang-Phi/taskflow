<?php

return [
    'secret' => env('JWT_SECRET', 'taskflow_s2'),
    'ttl' => env('JWT_TTL', 480),
    'algo' => 'HS256',
];
