<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BitrixService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BitrixController extends Controller
{
    protected BitrixService $bitrix;

    public function __construct(BitrixService $bitrix)
    {
        $this->bitrix = $bitrix;
    }

    /**
     * Ensure user's Bitrix token is valid before API calls.
     */
    private function prepareBitrix(Request $request): bool
    {
        $user = $request->user();
        $token = $this->bitrix->ensureValidToken($user);
        return $token !== null;
    }

    /**
     * Get list of users from Bitrix.
     */
    public function getUsers(Request $request): JsonResponse
    {
        if (!$this->prepareBitrix($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Bitrix token expired. Please re-open the app from Bitrix24.',
            ], 401);
        }

        $refresh = $request->input('refresh') === 'true';
        if ($refresh) {
            \Illuminate\Support\Facades\Cache::store('file')->forget('bitrix_users_all');
        }

        $synced = $this->bitrix->syncUsers();

        $transformed = array_map(function($user) {
            return [
                'id' => $user->id,
                'local_id' => $user->id,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo' => $user->photo,
                'department_ids' => $user->department_ids,
                'active' => $user->active,
                'work_position' => $user->work_position,
                'role' => $user->role,
            ];
        }, $synced);

        // Apply filters on Backend
        $search = trim($request->input('search'));
        $search = preg_replace('/\s+/', ' ', $search);
        $role = $request->input('role');
        $deptId = $request->input('department_id');
        $activeOnly = $request->input('active_only') === 'true' || $request->input('active') === 'true' || $request->input('active') === true;

        $filtered = array_filter($transformed, function ($u) use ($search, $role, $deptId, $activeOnly) {
            if ($activeOnly && !$u['active']) {
                return false;
            }

            if ($search) {
                $searchLower = mb_strtolower($search, 'UTF-8');
                $nameClean = preg_replace('/\s+/', ' ', trim($u['name'] ?? ''));
                $emailClean = preg_replace('/\s+/', ' ', trim($u['email'] ?? ''));
                $nameMatch = str_contains(mb_strtolower($nameClean, 'UTF-8'), $searchLower);
                $emailMatch = str_contains(mb_strtolower($emailClean, 'UTF-8'), $searchLower);
                if (!$nameMatch && !$emailMatch) {
                    return false;
                }
            }

            if ($role && $role !== 'all') {
                if ($u['role'] !== $role) {
                    return false;
                }
            }

            if ($deptId && $deptId !== 'all') {
                $rawDepts = $u['department_ids'];
                $uDepts = array_map('strval', is_array($rawDepts) ? $rawDepts : []);
                if (!in_array(strval($deptId), $uDepts, true)) {
                    return false;
                }
            }

            return true;
        });

        // Apply role & department-based visibility restrictions
        $currentUser = $request->user();
        if ($currentUser) {
            if ($currentUser->role === 'employee') {
                $filtered = array_filter($filtered, function ($u) use ($currentUser) {
                    return (int)$u['id'] === (int)$currentUser->id;
                });
            } elseif ($currentUser->role === 'manager') {
                if ($request->input('scope') === 'managed') {
                    $managedIds = $currentUser->getManagedUserIds();
                    $filtered = array_filter($filtered, function ($u) use ($managedIds) {
                        return in_array((int)$u['id'], $managedIds, true);
                    });
                }
            }
        }

        // Re-index array keys after array_filter
        $filtered = array_values($filtered);

        // Handle pagination parameters
        $total = count($filtered);
        $page = (int) $request->input('page', 1);
        $limit = (int) $request->input('limit', 10);
        
        if ($page < 1) $page = 1;
        if ($limit < 1) $limit = 10;

        $offset = ($page - 1) * $limit;
        $paginated = array_slice($filtered, $offset, $limit);

        return response()->json([
            'success' => true,
            'data' => $paginated,
            'meta' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => $total,
                'last_page' => (int) ceil($total / $limit),
            ],
        ]);
    }

    /**
     * Get a single user by Bitrix ID.
     */
    public function getUser(Request $request, int $id): JsonResponse
    {
        if (!$this->prepareBitrix($request)) {
            return response()->json(['success' => false, 'message' => 'Bitrix token expired'], 401);
        }

        $user = $this->bitrix->getUserById($id);

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }

        $localUser = \App\Models\User::find($id);
        $departments = $this->bitrix->getDepartments();

        // Determine role dynamically based on Bitrix department heads
        $role = 'employee';
        $superAdminId = (int) config('bitrix.super_admin_id', 632);
        if ((int)$id === $superAdminId) {
            $role = 'admin';
        } else if ($localUser && $localUser->role === 'admin') {
            $role = 'admin';
        } else {
            foreach ($departments as $dept) {
                $headId = $dept['UF_HEAD'] ?? null;
                if ($headId && (int)$headId === (int)$id) {
                    $role = 'manager';
                    break;
                }
            }
        }

        $currentUser = $request->user();
        if ($currentUser) {
            if ($currentUser->role === 'employee' && (int)$id !== (int)$currentUser->id) {
                return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
            }
            if ($currentUser->role === 'manager' && (int)$id !== (int)$currentUser->id) {
                // Managers are authorized to view profiles of other users.
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user['ID'],
                'name' => trim(($user['LAST_NAME'] ?? '') . ' ' . ($user['NAME'] ?? '')),
                'first_name' => $user['NAME'] ?? '',
                'last_name' => $user['LAST_NAME'] ?? '',
                'email' => $user['EMAIL'] ?? '',
                'phone' => $user['PERSONAL_MOBILE'] ?? $user['PERSONAL_PHONE'] ?? '',
                'photo' => $user['PERSONAL_PHOTO'] ?? null,
                'department_ids' => $user['UF_DEPARTMENT'] ?? [],
                'active' => in_array($user['ACTIVE'] ?? 'Y', ['Y', 1, '1', true], true),
                'work_position' => $user['WORK_POSITION'] ?? '',
                'role' => $role,
            ],
        ]);
    }
 
    /**
     * Update user's local app role (Only user 632 is allowed).
     */
    public function updateUser(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();
        $superAdminId = (int) config('bitrix.super_admin_id', 632);
        if (!$authUser || (int)$authUser->id !== $superAdminId) {
            return response()->json([
                'success' => false,
                'message' => 'Only the system administrator is authorized to modify user roles.',
            ], 403);
        }

        if ($id === $superAdminId) {
            return response()->json([
                'success' => false,
                'message' => 'The system administrator role is permanently locked and cannot be edited.',
            ], 400);
        }

        $request->validate([
            'role' => 'required|string|in:admin,employee',
        ]);

        if (!$this->prepareBitrix($request)) {
            return response()->json(['success' => false, 'message' => 'Bitrix token expired'], 401);
        }

        $bitrixUser = $this->bitrix->getUserById($id);
        if (!$bitrixUser) {
            return response()->json([
                'success' => false,
                'message' => 'User not found in Bitrix',
            ], 404);
        }

        $requestedRole = $request->input('role');
        $resolvedRole = $requestedRole;

        if ($requestedRole === 'employee') {
            // Check if they are a department head to fall back to 'manager', else 'employee'
            $departments = $this->bitrix->getDepartments();
            foreach ($departments as $dept) {
                $headId = $dept['UF_HEAD'] ?? null;
                if ($headId && (int)$headId === (int)$id) {
                    $resolvedRole = 'manager';
                    break;
                }
            }
        }

        $user = \App\Models\User::updateOrCreate(
            ['id' => $id],
            [
                'bitrix_id' => $id,
                'name' => trim(($bitrixUser['LAST_NAME'] ?? '') . ' ' . ($bitrixUser['NAME'] ?? '')),
                'first_name' => $bitrixUser['NAME'] ?? '',
                'last_name' => $bitrixUser['LAST_NAME'] ?? '',
                'email' => $bitrixUser['EMAIL'] ?? '',
                'phone' => $bitrixUser['PERSONAL_MOBILE'] ?? $bitrixUser['PERSONAL_PHONE'] ?? '',
                'photo' => $bitrixUser['PERSONAL_PHOTO'] ?? null,
                'department_ids' => $bitrixUser['UF_DEPARTMENT'] ?? [],
                'work_position' => $bitrixUser['WORK_POSITION'] ?? '',
                'active' => in_array($bitrixUser['ACTIVE'] ?? 'Y', ['Y', 1, '1', true], true),
                'role' => $resolvedRole,
            ]
        );

        \Illuminate\Support\Facades\Cache::store('file')->forget('bitrix_users_all');

        return response()->json([
            'success' => true,
            'message' => 'User role updated successfully.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Get list of departments from Bitrix.
     */
    public function getDepartments(Request $request): JsonResponse
    {
        if (!$this->prepareBitrix($request)) {
            return response()->json(['success' => false, 'message' => 'Bitrix token expired'], 401);
        }

        $departments = $this->bitrix->getDepartments();

        $transformed = array_map(fn($dept) => [
            'id' => $dept['ID'] ?? null,
            'name' => $dept['NAME'] ?? '',
            'parent_id' => $dept['PARENT'] ?? null,
            'head_user_id' => $dept['UF_HEAD'] ?? null,
            'sort' => $dept['SORT'] ?? 0,
        ], $departments);

        return response()->json([
            'success' => true,
            'data' => $transformed,
            'total' => count($transformed),
        ]);
    }

    public function customProxy(Request $request): JsonResponse
    {
        if (!$this->prepareBitrix($request)) {
            return response()->json(['success' => false, 'message' => 'Bitrix token expired'], 401);
        }

        $path = $request->input('path');
        if (!$path) {
            return response()->json(['success' => false, 'message' => 'Missing path parameter'], 400);
        }

        // SSRF & Path Traversal Mitigation: restrict path format strictly
        if (!is_string($path) || !str_starts_with($path, '/') || str_contains($path, '..') || str_contains($path, '//') || str_contains($path, '\\') || str_contains($path, '@') || str_contains($path, ':')) {
            return response()->json(['success' => false, 'message' => 'Invalid path format'], 400);
        }

        if (!preg_match('/^\/[a-zA-Z0-9_\-\.\/\?&=]+$/', $path)) {
            return response()->json(['success' => false, 'message' => 'Invalid characters in path'], 400);
        }

        $params = $request->except(['path']);
        $response = $this->bitrix->callCustomApi($path, $params);

        return response()->json([
            'success' => true,
            'data' => $response->json(),
        ]);
    }
}
