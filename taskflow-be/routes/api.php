<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BitrixController;

/*
|--------------------------------------------------------------------------
| API Routes – TaskFlow
|--------------------------------------------------------------------------
|
| OAuth2 Flow:
| 1. User opens app from Bitrix24 → Bitrix POST to /api/callback
| 2. Callback validates AUTH_ID → creates local user → Sanctum token
| 3. FE uses Sanctum token for all subsequent API calls
| 4. BE uses stored Bitrix access_token to call Bitrix REST API
|
*/

use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\EvaluationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\AiController;

// === Bitrix OAuth2 Callback (public, no auth) ===
Route::post('/callback', [AuthController::class, 'callback']);

// === Protected (Sanctum) ===
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/settings', [AuthController::class, 'updateSettings']);

    // Local Users (from DB, not Bitrix)
    Route::get('/users', [AuthController::class, 'listUsers']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Analytics
    Route::get('/analytics/data', [AnalyticsController::class, 'data']);

    // Bitrix Proxy – Users & Departments
    Route::get('/bitrix/users', [BitrixController::class, 'getUsers']);
    Route::get('/bitrix/users/{id}', [BitrixController::class, 'getUser']);
    Route::put('/bitrix/users/{id}', [BitrixController::class, 'updateUser']);
    Route::get('/bitrix/departments', [BitrixController::class, 'getDepartments']);

    // Bitrix Proxy – Custom API (e.g. /cv/api/filter-options.php)
    Route::get('/bitrix/custom', [BitrixController::class, 'customProxy']);

    // Projects
    Route::apiResource('projects', ProjectController::class);
    Route::post('projects/{id}/members', [ProjectController::class, 'addMember']);
    Route::delete('projects/{id}/members/{userId}', [ProjectController::class, 'removeMember']);
    Route::put('projects/{id}/statuses', [ProjectController::class, 'updateStatuses']);
    Route::get('projects/{id}/time-entries', [ProjectController::class, 'getTimeEntries']);
    Route::get('status-templates', [ProjectController::class, 'listStatusTemplates']);
    Route::post('status-templates', [ProjectController::class, 'createStatusTemplate']);
    Route::delete('status-templates/{id}', [ProjectController::class, 'deleteStatusTemplate']);

    // Tasks
    Route::apiResource('tasks', TaskController::class);
    Route::put('tasks/{id}/status', [TaskController::class, 'updateStatus']);
    Route::post('tasks/{id}/comments', [TaskController::class, 'storeComment']);
    Route::get('tasks/{id}/comments', [TaskController::class, 'getComments']);
    Route::get('tasks/{id}/activities', [TaskController::class, 'getActivities']);
    Route::post('comments/{id}/react', [TaskController::class, 'reactToComment']);
    Route::post('tasks/{id}/watch', [TaskController::class, 'toggleWatch']);
    Route::post('tasks/{id}/timer/start', [TaskController::class, 'startTimer']);
    Route::post('tasks/{id}/timer/stop', [TaskController::class, 'stopTimer']);
    Route::post('tasks/{id}/time-entries', [TaskController::class, 'addManualTime']);
    Route::delete('time-entries/{id}', [TaskController::class, 'deleteTimeEntry']);
    Route::get('me/timer/running', [TaskController::class, 'getRunningTimer']);
    Route::get('me/time-entries/today', [TaskController::class, 'getTodayTimeEntries']);
    Route::get('time-entries', [TaskController::class, 'getTimeEntriesList']);

    // AI Assistant
    Route::post('tasks/{id}/ai/checklist', [AiController::class, 'generateChecklist']);
    Route::post('tasks/{id}/ai/chat', [AiController::class, 'chat']);
    Route::post('ai/global/chat', [AiController::class, 'globalChat']);

    // Custom Fields
    Route::get('projects/{projectId}/custom-fields', [\App\Http\Controllers\Api\CustomFieldController::class, 'index']);
    Route::post('projects/{projectId}/custom-fields', [\App\Http\Controllers\Api\CustomFieldController::class, 'store']);
    Route::delete('custom-fields/{id}', [\App\Http\Controllers\Api\CustomFieldController::class, 'destroy']);
    Route::post('tasks/{taskId}/custom-field-values', [\App\Http\Controllers\Api\CustomFieldController::class, 'updateValues']);

    // Checklists
    Route::post('tasks/{taskId}/checklists', [\App\Http\Controllers\Api\ChecklistController::class, 'store']);
    Route::put('checklists/{id}', [\App\Http\Controllers\Api\ChecklistController::class, 'update']);
    Route::delete('checklists/{id}', [\App\Http\Controllers\Api\ChecklistController::class, 'destroy']);
    Route::post('checklists/{checklistId}/items', [\App\Http\Controllers\Api\ChecklistController::class, 'storeItem']);
    Route::put('checklist-items/{id}', [\App\Http\Controllers\Api\ChecklistController::class, 'updateItem']);
    Route::delete('checklist-items/{id}', [\App\Http\Controllers\Api\ChecklistController::class, 'destroyItem']);
    Route::post('checklist-items/{id}/convert', [\App\Http\Controllers\Api\ChecklistController::class, 'convertItem']);

    // Attachments
    Route::post('tasks/{taskId}/attachments', [\App\Http\Controllers\Api\AttachmentController::class, 'store']);
    Route::delete('attachments/{id}', [\App\Http\Controllers\Api\AttachmentController::class, 'destroy']);

    // Evaluations
    Route::get('evaluations', [EvaluationController::class, 'index']);
    Route::post('evaluations/generate', [EvaluationController::class, 'generate']);
    Route::get('evaluations/{id}', [EvaluationController::class, 'show']);
    Route::put('evaluations/{id}', [EvaluationController::class, 'update']);

    // Notifications
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read', [NotificationController::class, 'markRead']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);

    // Global Search
    Route::get('search', [\App\Http\Controllers\Api\SearchController::class, 'search']);

    // Broadcasting authentication
    Route::post('/broadcasting/auth', function (\Illuminate\Http\Request $request) {
        return \Illuminate\Support\Facades\Broadcast::auth($request);
    });
});
