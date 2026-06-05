<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProjectController extends Controller
{
    /**
     * Display a listing of projects.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Scope projects based on roles:
        // Admin sees all. Others see projects they created or are members of.
        $query = Project::with(['createdBy', 'members', 'tasks']);

        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $search = preg_replace('/\s+/', ' ', $search);
            if (!empty($search)) {
                $likePattern = '%' . str_replace(' ', '%', $search) . '%';
                $query->where(function ($q) use ($likePattern) {
                    $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                      ->orWhere('description', 'like', $likePattern);
                });
            }
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $status = $request->input('status');
            if ($status === 'on-hold') {
                $status = 'on_hold';
            }
            $query->where('status', $status);
        }

        if ($user->role !== 'admin') {
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            });
        }

        if ($request->has('page')) {
            $perPage = $request->input('per_page', 12);
            $paginated = $query->latest()->paginate($perPage);
            return response()->json([
                'success' => true,
                'data' => $paginated->items(),
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'has_more' => $paginated->hasMorePages(),
                ]
            ]);
        }

        $projects = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    /**
     * Store a newly created project.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string',
            'priority' => 'nullable|in:low,medium,high',
            'status' => 'nullable|in:planning,active,completed,on_hold',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'integer',
        ]);

        $user = $request->user();

        $project = DB::transaction(function () use ($request, $user) {
            $proj = Project::create([
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'color' => $request->input('color', '#6366f1'),
                'icon' => $request->input('icon'),
                'priority' => $request->input('priority', 'medium'),
                'status' => $request->input('status', 'active'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'created_by' => $user->id,
            ]);

            // Automatically add creator as manager member
            $proj->members()->attach($user->id, [
                'role' => 'manager',
                'joined_at' => now(),
            ]);

            // Add other selected members
            if ($request->has('member_ids')) {
                $memberIds = array_diff(array_map('intval', (array) $request->input('member_ids')), [$user->id]);
                if (!empty($memberIds)) {
                    $syncData = [];
                    foreach ($memberIds as $mId) {
                        $syncData[$mId] = [
                            'role' => 'member',
                            'joined_at' => now(),
                        ];
                    }
                    $proj->members()->attach($syncData);
                }
            }

            Log::info("User ID {$user->id} ({$user->name}) created Project ID {$proj->id} ({$proj->name})");

            return $proj;
        });

        return response()->json([
            'success' => true,
            'message' => 'Project created successfully',
            'data' => $project->load(['createdBy', 'members', 'tasks']),
        ], 210);
    }

    /**
     * Display the specified project.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $project = Project::with(['createdBy', 'members', 'tasks.assignee', 'tasks.labels', 'labels', 'customFields'])->find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        // Check if user is authorized to view
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to this project',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $project,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Update the specified project.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        // Allow only admin, creator, or project manager to edit
        $isProjectManager = $project->members()
            ->where('user_id', $user->id)
            ->where('project_members.role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update this project',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string',
            'priority' => 'nullable|in:low,medium,high',
            'status' => 'nullable|in:planning,active,completed,on_hold',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $project->update($request->only([
            'name',
            'description',
            'color',
            'icon',
            'priority',
            'status',
            'start_date',
            'end_date',
        ]));

        Log::info("User ID {$user->id} ({$user->name}) updated Project ID {$project->id} ({$project->name})");

        return response()->json([
            'success' => true,
            'message' => 'Project updated successfully',
            'data' => $project->load(['createdBy', 'members', 'tasks']),
        ]);
    }

    /**
     * Remove the specified project.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this project',
            ], 403);
        }

        $project->delete();

        Log::info("User ID {$user->id} ({$user->name}) deleted Project ID {$project->id} ({$project->name})");

        return response()->json([
            'success' => true,
            'message' => 'Project deleted successfully',
        ]);
    }

    /**
     * Add member to project.
     */
    public function addMember(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $request->validate([
            'user_id' => 'nullable',
            'user_ids' => 'nullable|array',
            'role' => 'nullable|in:manager,member',
        ]);

        // Check permission (admin, creator, manager)
        $user = $request->user();
        $isProjectManager = $project->members()
            ->where('user_id', $user->id)
            ->where('project_members.role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to manage project members',
            ], 403);
        }

        $role = $request->input('role', 'member');
        $bitrixIds = [];

        if ($request->has('user_ids')) {
            $bitrixIds = $request->input('user_ids');
        } elseif ($request->has('user_id')) {
            $bitrixIds = [$request->input('user_id')];
        }

        if (empty($bitrixIds)) {
            return response()->json([
                'success' => false,
                'message' => 'The user_id or user_ids field is required.',
            ], 422);
        }

        // Cast to array of integers
        $bitrixIds = array_map('intval', (array) $bitrixIds);

        // Fetch existing users from local DB by id
        $localUsers = \App\Models\User::whereIn('id', $bitrixIds)->get()->keyBy('id');

        $syncData = [];
        $bitrixService = null;

        foreach ($bitrixIds as $bitrixId) {
            $localUser = $localUsers->get($bitrixId);

            if (!$localUser) {
                // If not found locally, fetch from Bitrix and create local record
                if (!$bitrixService) {
                    $bitrixService = app(\App\Services\BitrixService::class);
                    $bitrixService->ensureValidToken($request->user());
                }

                try {
                    $bitrixUser = $bitrixService->getUserById($bitrixId);
                    if (!$bitrixUser) {
                        return response()->json([
                            'success' => false,
                            'message' => "Selected user ID {$bitrixId} was not found in Bitrix.",
                            'errors' => [
                                'user_id' => ["User ID {$bitrixId} not found."]
                            ]
                        ], 422);
                    }

                    $localUser = new \App\Models\User([
                        'id' => $bitrixId,
                        'bitrix_id' => $bitrixId,
                        'name' => trim(($bitrixUser['LAST_NAME'] ?? '') . ' ' . ($bitrixUser['NAME'] ?? '')),
                        'first_name' => $bitrixUser['NAME'] ?? '',
                        'last_name' => $bitrixUser['LAST_NAME'] ?? '',
                        'email' => $bitrixUser['EMAIL'] ?? '',
                        'phone' => $bitrixUser['PERSONAL_MOBILE'] ?? $bitrixUser['PERSONAL_PHONE'] ?? '',
                        'photo' => $bitrixUser['PERSONAL_PHOTO'] ?? null,
                        'work_position' => $bitrixUser['WORK_POSITION'] ?? '',
                        'active' => in_array($bitrixUser['ACTIVE'] ?? 'Y', ['Y', 1, '1', true], true),
                        'role' => 'employee',
                        'department_ids' => $bitrixUser['UF_DEPARTMENT'] ?? [],
                    ]);
                    $localUser->save();
                } catch (\Exception $e) {
                    Log::error("Failed to create local user for Bitrix ID {$bitrixId}: " . $e->getMessage());
                    return response()->json([
                        'success' => false,
                        'message' => "Could not sync Bitrix user {$bitrixId}: " . $e->getMessage(),
                    ], 500);
                }
            }

            // Sync using the local user's ID
            $syncData[$localUser->id] = [
                'role' => $role,
                'joined_at' => now(),
            ];
        }

        $project->members()->syncWithoutDetaching($syncData);

        Log::info("User ID {$user->id} ({$user->name}) added Users [" . implode(', ', $bitrixIds) . "] to Project ID {$project->id}");

        return response()->json([
            'success' => true,
            'message' => 'Members added to project successfully',
            'data' => $project->load('members'),
        ]);
    }

    /**
     * Remove member from project.
     */
    public function removeMember(Request $request, $id, $userId): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        // Check permission (admin, creator, manager)
        $user = $request->user();
        $isProjectManager = $project->members()
            ->where('user_id', $user->id)
            ->where('project_members.role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to manage project members',
            ], 403);
        }

        // Prevent removing the project creator/owner
        if ((int)$userId === (int)$project->created_by) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot remove project creator from members',
            ], 422);
        }

        $project->members()->detach($userId);

        Log::info("User ID {$user->id} ({$user->name}) removed User ID {$userId} from Project ID {$project->id}");

        return response()->json([
            'success' => true,
            'message' => 'Member removed from project successfully',
            'data' => $project->load('members'),
        ]);
    }

    /**
     * Update project custom statuses.
     */
    public function updateStatuses(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        $isProjectManager = $project->members()
            ->where('user_id', $user->id)
            ->where('project_members.role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update project statuses',
            ], 403);
        }

        $request->validate([
            'statuses' => 'required|array',
            'statuses.*.id' => 'required|string',
            'statuses.*.name' => 'required|string',
            'statuses.*.color' => 'required|string',
            'statuses.*.type' => 'required|string|in:not_started,active,done,closed',
            'statuses.*.position' => 'required|integer',
            'status_mappings' => 'nullable|array',
        ]);

        $newStatuses = $request->input('statuses');
        $newStatusIds = array_column($newStatuses, 'id');

        // Check if there are tasks with statuses not in the new statuses list
        $activeTaskStatuses = $project->tasks()
            ->whereNotNull('status')
            ->distinct()
            ->pluck('status')
            ->toArray();

        $orphanedStatuses = array_diff($activeTaskStatuses, $newStatusIds);

        if (!empty($orphanedStatuses)) {
            $mappings = $request->input('status_mappings') ?: [];
            
            // Check if any orphaned status lacks a mapping in $mappings
            $unmappedStatuses = [];
            foreach ($orphanedStatuses as $osId) {
                if (!isset($mappings[$osId]) || !in_array($mappings[$osId], $newStatusIds)) {
                    $unmappedStatuses[] = $osId;
                }
            }

            if (!empty($unmappedStatuses)) {
                $oldStatuses = $project->statuses ?: [];
                $oldStatusMap = [];
                foreach ($oldStatuses as $os) {
                    if (is_array($os) && isset($os['id'])) {
                        $oldStatusMap[$os['id']] = isset($os['name']) ? $os['name'] : $os['id'];
                    }
                }

                $orphanedInfo = [];
                foreach ($unmappedStatuses as $osId) {
                    $orphanedInfo[] = [
                        'id' => $osId,
                        'name' => isset($oldStatusMap[$osId]) ? $oldStatusMap[$osId] : $osId
                    ];
                }

                return response()->json([
                    'success' => false,
                    'requires_mapping' => true,
                    'orphaned_statuses' => $orphanedInfo,
                    'message' => 'Some statuses are being removed but still contain tasks. Please map them.',
                ]);
            }

            // Perform mappings
            foreach ($mappings as $oldStatus => $newStatus) {
                if (in_array($oldStatus, $orphanedStatuses)) {
                    $project->tasks()->where('status', $oldStatus)->update(['status' => $newStatus]);
                }
            }
        }

        $project->update([
            'statuses' => $newStatuses
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Project statuses updated successfully',
            'data' => $project,
        ]);
    }

    /**
     * List status templates.
     */
    public function listStatusTemplates(Request $request): JsonResponse
    {
        $user = $request->user();
        $templates = \App\Models\StatusTemplate::whereNull('created_by')
            ->orWhere('created_by', $user->id)
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * Create status template.
     */
    public function createStatusTemplate(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'statuses' => 'required|array',
            'statuses.*.id' => 'required|string',
            'statuses.*.name' => 'required|string',
            'statuses.*.color' => 'required|string',
            'statuses.*.type' => 'required|string|in:not_started,active,done,closed',
            'statuses.*.position' => 'required|integer',
        ]);

        $user = $request->user();
        $template = \App\Models\StatusTemplate::create([
            'name' => $request->input('name'),
            'statuses' => $request->input('statuses'),
            'created_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template created successfully',
            'data' => $template,
        ]);
    }

    /**
     * Delete status template.
     */
    public function deleteStatusTemplate(Request $request, $id): JsonResponse
    {
        $template = \App\Models\StatusTemplate::find($id);

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Template not found',
            ], 404);
        }

        $user = $request->user();
        if ($template->created_by !== $user->id && $user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this template',
            ], 403);
        }

        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully',
        ]);
    }

    /**
     * Get all time entries logged under this project.
     */
    public function getTimeEntries(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);
        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to project time entries',
            ], 403);
        }

        $timeEntries = \App\Models\TimeEntry::whereHas('task', function ($q) use ($id) {
            $q->where('project_id', $id);
        })
        ->with(['user', 'task'])
        ->orderBy('started_at', 'desc')
        ->get();

        return response()->json([
            'success' => true,
            'data' => $timeEntries,
        ]);
    }

    /**
     * GET /api/projects/{id}/workflow
     * Returns the project's workflow configuration with available status list.
     */
    public function getWorkflow(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to this project',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'workflow' => $project->workflow,
                'statuses' => $project->statuses,
            ],
        ]);
    }

    /**
     * PUT /api/projects/{id}/workflow
     * Validates and saves the project's workflow configuration.
     * Only manager/admin/creator can update.
     */
    public function updateWorkflow(Request $request, $id): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        $isProjectManager = $project->members()
            ->where('user_id', $user->id)
            ->where('project_members.role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update project workflow',
            ], 403);
        }

        $request->validate([
            'mode' => 'required|string|in:unrestricted,restricted',
            'transitions' => 'present|array',
            'transitions.*.id' => 'required|string',
            'transitions.*.name' => 'nullable|string',
            'transitions.*.from' => 'required|string',
            'transitions.*.to' => 'required|string',
            'transitions.*.allowed_roles' => 'nullable|array',
            'transitions.*.rules' => 'nullable|array',
            'global_transitions' => 'present|array',
            'global_transitions.*.id' => 'required|string',
            'global_transitions.*.name' => 'nullable|string',
            'global_transitions.*.to' => 'required|string',
            'global_transitions.*.allowed_roles' => 'nullable|array',
            'global_transitions.*.rules' => 'nullable|array',
            'node_positions' => 'nullable|array',
        ]);

        // Validate that all from/to status IDs exist in project statuses
        $projectStatusIds = array_column($project->statuses, 'id');
        $invalidStatuses = [];

        foreach ($request->input('transitions', []) as $transition) {
            if (!in_array($transition['from'], $projectStatusIds)) {
                $invalidStatuses[] = $transition['from'];
            }
            if (!in_array($transition['to'], $projectStatusIds)) {
                $invalidStatuses[] = $transition['to'];
            }
        }

        foreach ($request->input('global_transitions', []) as $globalTransition) {
            if (!in_array($globalTransition['to'], $projectStatusIds)) {
                $invalidStatuses[] = $globalTransition['to'];
            }
        }

        if (!empty($invalidStatuses)) {
            return response()->json([
                'success' => false,
                'message' => 'Some status IDs in transitions do not exist in the project statuses',
                'invalid_statuses' => array_values(array_unique($invalidStatuses)),
            ], 422);
        }

        $wfModel = $project->workflow()->firstOrCreate([], [
            'mode' => $request->input('mode'),
        ]);
        $wfModel->update([
            'mode'           => $request->input('mode'),
            'initial_status' => $request->input('initial_status'),
        ]);

        DB::transaction(function () use ($request, $wfModel) {
            // Delete old transitions and rules
            $transitionIds = $wfModel->transitionsRelation()->pluck('id')->toArray();
            \App\Models\WorkflowTransitionRule::whereIn('workflow_transition_id', $transitionIds)->delete();
            $wfModel->transitionsRelation()->delete();

            // Insert new regular transitions
            foreach ($request->input('transitions', []) as $t) {
                $createdTransition = $wfModel->transitionsRelation()->create([
                    'transition_key' => $t['id'],
                    'name' => $t['name'] ?? null,
                    'from' => $t['from'],
                    'to' => $t['to'],
                    'allowed_roles' => $t['allowed_roles'] ?? [],
                    'is_global' => false,
                ]);

                foreach ($t['rules'] ?? [] as $r) {
                    $createdTransition->rulesRelation()->create([
                        'type' => $r['type'],
                        'config' => $r['config'] ?? [],
                    ]);
                }
            }

            // Insert new global transitions
            foreach ($request->input('global_transitions', []) as $gt) {
                $createdTransition = $wfModel->transitionsRelation()->create([
                    'transition_key' => $gt['id'],
                    'name' => $gt['name'] ?? null,
                    'from' => null,
                    'to' => $gt['to'],
                    'allowed_roles' => $gt['allowed_roles'] ?? [],
                    'is_global' => true,
                ]);

                foreach ($gt['rules'] ?? [] as $r) {
                    $createdTransition->rulesRelation()->create([
                        'type' => $r['type'],
                        'config' => $r['config'] ?? [],
                    ]);
                }
            }

            // Save node positions
            $wfModel->nodePositionsRelation()->delete();
            foreach ($request->input('node_positions', []) as $statusId => $pos) {
                $wfModel->nodePositionsRelation()->create([
                    'status_id' => $statusId,
                    'x' => $pos['x'] ?? 0,
                    'y' => $pos['y'] ?? 0,
                ]);
            }
        });

        $project->load('workflow');

        Log::info("User ID {$user->id} ({$user->name}) updated workflow for Project ID {$project->id}");

        return response()->json([
            'success' => true,
            'message' => 'Workflow updated successfully',
            'data' => [
                'workflow' => $project->workflow,
                'statuses' => $project->statuses,
            ],
        ]);
    }

    /**
     * GET /api/projects/{id}/transitions/{statusId}
     * Returns list of allowed transitions from the given status for the current user.
     * Used by frontend to know which columns to highlight during drag.
     */
    public function getAvailableTransitions(Request $request, $id, $statusId): JsonResponse
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to this project',
            ], 403);
        }

        // Validate that the statusId exists in project statuses
        $projectStatusIds = array_column($project->statuses, 'id');
        if (!in_array($statusId, $projectStatusIds)) {
            return response()->json([
                'success' => false,
                'message' => 'Status not found in project',
            ], 404);
        }

        $userProjectRole = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->value('role') ?? 'member';

        $transitions = $project->getAvailableTransitions(
            $statusId,
            $userProjectRole,
            $user->role === 'admin',
            $user->id
        );

        return response()->json([
            'success' => true,
            'data' => [
                'from_status' => $statusId,
                'transitions' => $transitions,
                'allowed_status_ids' => array_values(array_unique(array_map(fn($t) => $t['to'], $transitions))),
                'workflow_mode' => $project->workflow['mode'] ?? 'unrestricted',
            ],
        ]);
    }
}

