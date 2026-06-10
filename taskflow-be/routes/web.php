<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;

Route::get('/', function () {
    return view('welcome');
});

// Bitrix OAuth2 – step 1: redirect to Bitrix login
Route::middleware(['throttle:10,1'])->get('/auth/redirect', [AuthController::class, 'redirect']);

// Bitrix OAuth2 – step 2: callback (Bitrix redirects here with ?code= or POSTs AUTH_ID)
Route::middleware(['throttle:30,1'])->match(['get', 'post'], '/callback', [AuthController::class, 'callback']);

Route::get('/public/storage/{path}', function ($path) {
    if (!\Illuminate\Support\Facades\Storage::disk('public')->exists($path)) {
        abort(404);
    }
    
    $file = \Illuminate\Support\Facades\Storage::disk('public')->get($path);
    $mime = \Illuminate\Support\Facades\Storage::disk('public')->mimeType($path);
    
    return \Illuminate\Support\Facades\Response::make($file, 200, [
        'Content-Type' => $mime,
        'Content-Disposition' => 'inline; filename="' . basename($path) . '"'
    ]);
})->where('path', '.*');

Route::get('/storage/{path}', function ($path) {
    if (!\Illuminate\Support\Facades\Storage::disk('public')->exists($path)) {
        abort(404);
    }
    
    $file = \Illuminate\Support\Facades\Storage::disk('public')->get($path);
    $mime = \Illuminate\Support\Facades\Storage::disk('public')->mimeType($path);
    
    return \Illuminate\Support\Facades\Response::make($file, 200, [
        'Content-Type' => $mime,
        'Content-Disposition' => 'inline; filename="' . basename($path) . '"'
    ]);
})->where('path', '.*');
