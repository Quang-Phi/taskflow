<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /**
     * Search tasks, projects, and users.
     */
    public function search(Request $request): JsonResponse
    {
        $queryClean = trim($request->input('q'));
        // Normalize multiple spaces to a single space
        $queryClean = preg_replace('/\s+/', ' ', $queryClean);

        if (empty($queryClean) || strlen($queryClean) < 2) {
            return response()->json([
                'success' => true,
                'data' => [
                    'tasks' => [],
                    'projects' => [],
                    'members' => [],
                ],
            ]);
        }

        // Generate wildcard pattern by replacing space with % to handle multiple spaces in DB
        $likePattern = '%' . str_replace(' ', '%', $queryClean) . '%';

        $user = $request->user();

        // Search Tasks (restricted by project membership/ownership for non-admin)
        $tasksQuery = Task::query()->with(['project', 'assignee']);
        if ($user->role !== 'admin') {
            $tasksQuery->whereHas('project', function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            });
        }
        $tasks = $tasksQuery->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(title) LIKE ?', [$likePattern])
                  ->orWhere('description', 'LIKE', $likePattern)
                  ->orWhere('id', 'LIKE', $likePattern);
            })
            ->limit(10)
            ->get();

        // Search Projects (restricted by project membership/ownership for non-admin)
        $projectsQuery = Project::query();
        if ($user->role !== 'admin') {
            $projectsQuery->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            });
        }
        $projects = $projectsQuery->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhere('description', 'LIKE', $likePattern);
            })
            ->limit(10)
            ->get();

        // Search Members (Users) - restricted by role
        $membersQuery = User::query();
        $membersQuery->where('active', true);

        if ($user->role === 'employee') {
            $membersQuery->where('id', $user->id);
        } elseif ($user->role === 'manager') {
            $managedDeptIds = [];
            try {
                $bitrix = app(\App\Services\BitrixService::class);
                $bitrix->ensureValidToken($user);
                $departments = $bitrix->getDepartments();
                foreach ($departments as $dept) {
                    $headId = $dept['UF_HEAD'] ?? null;
                    if ($headId && (int)$headId === (int)$user->id) {
                        $managedDeptIds[] = (int)$dept['ID'];
                    }
                }

                // Recursively get sub-departments
                if (!empty($managedDeptIds)) {
                    $allManagedIds = $managedDeptIds;
                    $added = true;
                    while ($added) {
                        $added = false;
                        foreach ($departments as $dept) {
                            $deptId = (int)$dept['ID'];
                            $parentId = isset($dept['PARENT']) ? (int)$dept['PARENT'] : null;
                            if ($parentId && in_array($parentId, $allManagedIds, true) && !in_array($deptId, $allManagedIds, true)) {
                                $allManagedIds[] = $deptId;
                                $added = true;
                            }
                        }
                    }
                    $managedDeptIds = $allManagedIds;
                }
            } catch (\Exception $e) {
                $managedDeptIds = $user->department_ids ?? [];
            }

            $membersQuery->where(function ($q) use ($user, $managedDeptIds) {
                $q->where('id', $user->id);
                foreach ($managedDeptIds as $deptId) {
                    $q->orWhereJsonContains('department_ids', (int)$deptId);
                }
            });
        }

        $members = $membersQuery->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(email) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(work_position) LIKE ?', [$likePattern]);
            })
            ->limit(10)
            ->get(['id', 'name', 'email', 'photo', 'work_position', 'role']);

        return response()->json([
            'success' => true,
            'data' => [
                'tasks' => $tasks,
                'projects' => $projects,
                'members' => $members,
            ],
        ]);
    }
}
