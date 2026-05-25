<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;

Route::get('/', function () {
    return view('welcome');
});

// Bitrix OAuth2 – step 1: redirect to Bitrix login
Route::get('/auth/redirect', [AuthController::class, 'redirect']);

// Bitrix OAuth2 – step 2: callback (Bitrix redirects here with ?code= or POSTs AUTH_ID)
Route::match(['get', 'post'], '/callback', [AuthController::class, 'callback']);
