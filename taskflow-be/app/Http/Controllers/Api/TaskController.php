<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\Project;
use App\Models\TaskAssignee;
use App\Models\TaskApproval;
use App\Models\TaskComment;
use App\Models\CommentReaction;
use App\Models\TaskActivity;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\TaskDependency;
use App\Models\Notification;
use App\Events\TaskUpdated;
use App\Events\TimeTrackingUpdated;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    /**
     * Display a listing of tasks.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'assignee_id' => 'nullable|exists:users,id',
            'creator_id' => 'nullable|exists:users,id',
        ]);

        $user = $request->user();

        if ($request->has('project_id')) {
            $projectId = $request->input('project_id');
            $project = Project::find($projectId);
            if ($project) {
                if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized access to this project tasks',
                    ], 403);
                }
            }
        }

        $query = Task::with(['assignee', 'creator', 'labels', 'project.members', 'timeEntries.user', 'dependencies.targetTask', 'inverseDependencies.task']);

        if ($request->has('project_id')) {
            $query->where('project_id', $request->input('project_id'));
            if ($request->input('include_subtasks') !== 'true') {
                $query->whereNull('parent_task_id');
            }
        }

        if ($request->has('assignee_id')) {
            $query->where('assignee_id', $request->input('assignee_id'));
        }

        if ($request->has('creator_id')) {
            $query->where('creator_id', $request->input('creator_id'));
        }

        if (!in_array($user->role, ['admin', 'superadmin'])) {
            $query->where(function ($q) use ($user) {
                $q->whereHas('project', function ($projQ) use ($user) {
                    $projQ->where('created_by', $user->id)
                          ->orWhereHas('members', function ($sub) use ($user) {
                              $sub->where('user_id', $user->id)
                                  ->where('project_members.role', '!=', 'collaborator');
                          });
                })
                ->orWhere(function ($taskQ) use ($user) {
                    $taskQ->where(function ($subT) use ($user) {
                        $subT->where('assignee_id', $user->id)
                             ->orWhere('creator_id', $user->id)
                             ->orWhereHas('parentTask', function ($parentQ) use ($user) {
                                 $parentQ->where('assignee_id', $user->id)
                                          ->orWhere('creator_id', $user->id);
                             });
                    })->whereHas('project', function ($projQ) use ($user) {
                        $projQ->whereHas('members', function ($sub) use ($user) {
                            $sub->where('user_id', $user->id)
                                ->where('project_members.role', '=', 'collaborator');
                        });
                    });
                });
            });
        }

        $tasks = $query->orderBy('position')->get();

        return response()->json([
            'success' => true,
            'data' => $tasks,
        ]);
    }

    /**
     * Store a newly created task.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|in:urgent,high,medium,low',
            'type' => 'nullable|in:task,bug',
            'assignee_id' => 'nullable|exists:users,id',
            'estimated_hours' => 'nullable|integer|min:0',
            'actual_hours' => 'nullable|integer|min:0',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'parent_task_id' => 'nullable|exists:tasks,id',
            'is_recurring' => 'nullable|boolean',
            'recurring_frequency' => 'nullable|string|in:daily,weekly,monthly,yearly',
            'recurring_interval' => 'nullable|integer|min:1',
            'recurring_weekdays' => 'nullable|array',
            'recurring_monthday' => 'nullable|integer|min:1|max:31',
            'recurring_time' => 'nullable|string',
            'template_id' => 'nullable|exists:task_templates,id',
            'milestone_id' => 'nullable|exists:milestones,id',
        ]);

        $projectId = $request->input('project_id');
        $project = Project::find($projectId);
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
                'message' => 'Unauthorized to create task in this project',
            ], 403);
        }

        // Validate task assignment permissions
        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();
        $isAuthorized = ($user->role === 'admin' || $project->created_by === $user->id || $isProjectManager);

        if (!$isAuthorized) {
            $assigneeId = $request->input('assignee_id');
            $parentTaskId = $request->input('parent_task_id');
            
            // Standard members can only assign tasks to themselves, unless it is a subtask
            if ($assigneeId !== null && (int)$assigneeId !== (int)$user->id && !$parentTaskId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Standard members can only assign main tasks to themselves.',
                ], 403);
            }
        }

        $projectStatuses = $project->statuses;

        // Workflow initial_status always wins for new tasks.
        // If the workflow defines a starting point, ignore whatever status the FE sends.
        $workflowInitialStatus = $project->workflow()->value('initial_status');
        $firstStatusId = $projectStatuses[0]['id'] ?? 'todo';

        if ($workflowInitialStatus) {
            // Enforce workflow start status — FE has no say
            $status = $workflowInitialStatus;
        } else {
            // No workflow rule — use whatever FE sent, fallback to first status
            $status = $request->input('status', $firstStatusId);
        }

        // Validate status exists in project
        $validStatusIds = array_column($projectStatuses, 'id');
        if (!in_array($status, $validStatusIds)) {
            // Fallback gracefully if initial_status is stale/invalid
            $status = $firstStatusId;
        }

        // Determine position for new task
        $maxPosition = Task::where('project_id', $projectId)
            ->where('status', $status)
            ->max('position') ?? 0;

        $isClosed = false;
        foreach ($projectStatuses as $s) {
            if ($s['id'] === $status && in_array($s['type'] ?? '', ['closed', 'done'])) {
                $isClosed = true;
                break;
            }
        }

        $startDate = $request->input('start_date');
        $dueDate = $request->input('due_date');
        $est = null;
        if ($startDate && $dueDate) {
            $est = (int)round($this->calculateWorkingMinutes($startDate, $dueDate) / 60);
        }

        $templateId = $request->input('template_id');
        $template = null;
        if ($templateId) {
            $template = \App\Models\TaskTemplate::find($templateId);
        }

        $description = $request->input('description') ?? ($template ? $template->description : null);
        $type = $request->input('type') ?? ($template ? $template->type : 'task');
        $priority = $request->input('priority') ?? ($template ? $template->priority : 'medium');
        $est = ($startDate && $dueDate) ? $est : ($template ? $template->estimated_hours : null);

        $task = Task::create([
            'project_id' => $projectId,
            'title' => $request->input('title'),
            'description' => $description,
            'status' => $status,
            'priority' => $priority,
            'type' => $type,
            'assignee_id' => $request->input('assignee_id'),
            'creator_id' => $request->user()->id,
            'estimated_hours' => $est,
            'actual_hours' => $request->input('actual_hours'),
            'start_date' => $startDate,
            'due_date' => $dueDate,
            'completed_at' => $isClosed ? now() : null,
            'parent_task_id' => $request->input('parent_task_id'),
            'position' => $maxPosition + 1,
            'is_recurring' => $request->input('is_recurring', false),
            'recurring_frequency' => $request->input('recurring_frequency'),
            'recurring_interval' => $request->input('recurring_interval', 1),
            'recurring_weekdays' => $request->input('recurring_weekdays'),
            'recurring_monthday' => $request->input('recurring_monthday'),
            'recurring_time' => $request->input('recurring_time'),
            'milestone_id' => $request->input('milestone_id'),
        ]);

        if ($template) {
            // Apply checklists
            if ($template->checklist_template && is_array($template->checklist_template)) {
                foreach ($template->checklist_template as $clData) {
                    $cl = \App\Models\Checklist::create([
                        'task_id' => $task->id,
                        'name' => $clData['name'],
                        'position' => $clData['position'] ?? 1,
                    ]);
                    if (isset($clData['items']) && is_array($clData['items'])) {
                        foreach ($clData['items'] as $itemData) {
                            \App\Models\ChecklistItem::create([
                                'checklist_id' => $cl->id,
                                'name' => $itemData['name'],
                                'is_checked' => $itemData['is_checked'] ?? false,
                                'position' => $itemData['position'] ?? 1,
                            ]);
                        }
                    }
                }
            }

            // Apply subtasks
            if ($template->subtask_template && is_array($template->subtask_template)) {
                foreach ($template->subtask_template as $subtaskData) {
                    \App\Models\Task::create([
                        'project_id' => $task->project_id,
                        'parent_task_id' => $task->id,
                        'title' => $subtaskData['title'],
                        'description' => $subtaskData['description'] ?? null,
                        'status' => 'todo',
                        'priority' => $subtaskData['priority'] ?? 'medium',
                        'type' => $subtaskData['type'] ?? 'task',
                        'estimated_hours' => $subtaskData['estimated_hours'] ?? null,
                        'creator_id' => $request->user()->id,
                    ]);
                }
            }
        }

        if ($task->is_recurring) {
            $task->recurring_next_trigger = $task->calculateNextTriggerDate();
            $task->save();
        }

        $this->logActivity($task->id, $request->user()->id, 'created', 'Created this task.');

        // Notify assignee about task assignment
        if ($task->assignee_id) {
            Notification::notify(
                $task->assignee_id,
                $request->user()->id,
                'task_assigned',
                'assigned you a task',
                $task->title,
                null,
                $task->id,
                $task->project_id
            );
        }

        Log::info("User ID {$request->user()->id} ({$request->user()->name}) created Task ID {$task->id} ({$task->title}) in Project ID {$projectId}");

        $loadedTask = $task->load(['assignee', 'creator', 'labels']);
        event(new TaskUpdated((int)$projectId, 'created', $loadedTask->toArray()));

        return response()->json([
            'success' => true,
            'message' => 'Task created successfully',
            'data' => $loadedTask,
        ]);
    }

    /**
     * Display the specified task.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $task = Task::with([
            'assignee', 
            'creator', 
            'labels', 
            'project',
            'parentTask',
            'comments' => function ($query) {
                $query->orderBy('created_at', 'desc')->limit(15);
            },
            'comments.user',
            'comments.reactions',
            'activities' => function ($query) {
                $query->orderBy('created_at', 'desc')->limit(20);
            },
            'activities.user',
            'subtasks' => function ($query) {
                $query->orderBy('position');
            },
            'subtasks.assignee',
            'timeEntries' => function ($query) {
                $query->orderBy('started_at', 'desc');
            },
            'timeEntries.user',
            'customFieldValues.customField',
            'checklists.items.assignee',
            'attachments.user',
            'dependencies.targetTask',
            'inverseDependencies.task',
            'template',
        ])->withCount(['comments', 'activities'])->find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view this task',
            ], 403);
        }

        // Collaborator viewing restriction
        if (!in_array($user->role, ['admin', 'superadmin']) && $project->created_by !== $user->id) {
            $projectMember = $project->members()->where('user_id', $user->id)->first();
            if ($projectMember && $projectMember->pivot->role === 'collaborator') {
                $isAssignee = (int)$task->assignee_id === (int)$user->id;
                $isCreator = (int)$task->creator_id === (int)$user->id;
                $isWatcher = in_array($user->id, $task->watcher_ids ?? []);
                $isSubtaskAssignee = $task->subtasks->contains('assignee_id', $user->id);

                // Allow access if user has access to the parent task
                $isParentAllowed = false;
                if ($task->parent_task_id) {
                    $parent = $task->parentTask ?: \App\Models\Task::find($task->parent_task_id);
                    if ($parent) {
                        $isParentAssignee = (int)$parent->assignee_id === (int)$user->id;
                        $isParentCreator = (int)$parent->creator_id === (int)$user->id;
                        $isParentWatcher = in_array($user->id, $parent->watcher_ids ?? []);
                        if ($isParentAssignee || $isParentCreator || $isParentWatcher) {
                            $isParentAllowed = true;
                        }
                    }
                }

                if (!$isAssignee && !$isCreator && !$isWatcher && !$isSubtaskAssignee && !$isParentAllowed) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized to view this task',
                    ], 403);
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => $task,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Update the specified task.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        $isAuthorized = ($user->role === 'admin' || $project->created_by === $user->id || $isProjectManager);

        if (!$isAuthorized) {
            $isOwnTask = ($task->creator_id === $user->id || $task->assignee_id === $user->id);
            $isProjectMember = $project->members->contains($user->id);

            if (!$isProjectMember || !$isOwnTask) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to update this task',
                ], 403);
            }

            // Standard members can only assign tasks to themselves, unless it is a subtask
            if ($request->has('assignee_id')) {
                $newAssigneeId = $request->input('assignee_id');
                if ($newAssigneeId !== null && (int)$newAssigneeId !== (int)$task->assignee_id && (int)$newAssigneeId !== (int)$user->id) {
                    $isSubtask = ($task->parent_task_id !== null) || ($request->has('parent_task_id') && $request->input('parent_task_id') !== null);
                    if (!$isSubtask) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Standard members can only assign main tasks to themselves.',
                        ], 403);
                    }
                }
            }
        }

        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|in:urgent,high,medium,low',
            'type' => 'nullable|in:task,bug',
            'assignee_id' => 'nullable|exists:users,id',
            'estimated_hours' => 'nullable|integer|min:0',
            'actual_hours' => 'nullable|integer|min:0',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'parent_task_id' => 'nullable|exists:tasks,id',
            'is_recurring' => 'nullable|boolean',
            'recurring_frequency' => 'nullable|string|in:daily,weekly,monthly,yearly',
            'recurring_interval' => 'nullable|integer|min:1',
            'recurring_weekdays' => 'nullable|array',
            'recurring_monthday' => 'nullable|integer|min:1|max:31',
            'recurring_time' => 'nullable|string',
            'milestone_id' => 'nullable|exists:milestones,id',
        ]);

        if ($request->has('parent_task_id')) {
            $parentId = $request->input('parent_task_id');
            if ($parentId) {
                if ($parentId == $id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'A task cannot be its own parent.',
                    ], 422);
                }
                if ($this->isDescendantOf($id, $parentId)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Circular dependency detected. The selected parent is a subtask of this task.',
                    ], 422);
                }
            }
        }

        $newStatus = $request->input('status');

        // Workflow transition validation when status is changing
        if ($request->has('status') && $newStatus !== $task->status) {
            $workflowError = $this->checkWorkflowTransition($task, $newStatus, $user);
            if ($workflowError) {
                return $workflowError;
            }
        }

        $oldTitle = $task->title;
        $oldStatus = $task->status;
        $oldAssigneeId = $task->assignee_id;
        $oldEst = $task->estimated_hours;
        $oldAct = $task->actual_hours;
        $oldDescription = $task->description;
        $oldPriority = $task->priority;
        $oldStartDate = $task->start_date;
        $oldDueDate = $task->due_date;

        $updates = $request->only([
            'title',
            'description',
            'status',
            'priority',
            'type',
            'assignee_id',
            'estimated_hours',
            'actual_hours',
            'start_date',
            'due_date',
            'parent_task_id',
            'is_recurring',
            'recurring_frequency',
            'recurring_interval',
            'recurring_weekdays',
            'recurring_monthday',
            'recurring_time',
            'milestone_id',
        ]);

        if ($request->has('start_date') || $request->has('due_date')) {
            $finalStartDate = $request->has('start_date') ? $request->input('start_date') : $task->start_date;
            $finalDueDate = $request->has('due_date') ? $request->input('due_date') : $task->due_date;
            if ($finalStartDate && $finalDueDate) {
                $updates['estimated_hours'] = (int)round($this->calculateWorkingMinutes($finalStartDate, $finalDueDate) / 60);
            } else {
                $updates['estimated_hours'] = null;
            }
        }

        if ($request->has('status')) {
            $projectStatuses = $project->statuses;
            
            $newIsClosed = false;
            foreach ($projectStatuses as $s) {
                if ($s['id'] === $newStatus && in_array($s['type'] ?? '', ['closed', 'done'])) {
                    $newIsClosed = true;
                    break;
                }
            }

            $oldIsClosed = false;
            foreach ($projectStatuses as $s) {
                if ($s['id'] === $task->status && in_array($s['type'] ?? '', ['closed', 'done'])) {
                    $oldIsClosed = true;
                    break;
                }
            }

            if ($newIsClosed && !$oldIsClosed) {
                $updates['completed_at'] = now();
            } elseif (!$newIsClosed && $oldIsClosed) {
                $updates['completed_at'] = null;
            }

            // Apply workflow post-action rules
            $workflow = $project->workflow;
            if (($workflow['mode'] ?? 'unrestricted') === 'restricted') {
                $transitions = $workflow['transitions'] ?? [];
                $globalTransitions = $workflow['global_transitions'] ?? [];
                $matchedTransition = null;

                foreach ($transitions as $t) {
                    if (($t['from'] ?? '') === $task->status && ($t['to'] ?? '') === $newStatus) {
                        $matchedTransition = $t;
                        break;
                    }
                }

                if (!$matchedTransition) {
                    foreach ($globalTransitions as $gt) {
                        if (($gt['to'] ?? '') === $newStatus) {
                            $matchedTransition = $gt;
                            break;
                        }
                    }
                }

                if ($matchedTransition && !empty($matchedTransition['rules'])) {
                    foreach ($matchedTransition['rules'] as $rule) {
                        $ruleType = $rule['type'] ?? '';
                        if ($ruleType === 'assign_user') {
                            if (($rule['config']['to'] ?? '') === 'current_user') {
                                $updates['assignee_id'] = $user->id;
                            } elseif (($rule['config']['to'] ?? '') === 'clear') {
                                $updates['assignee_id'] = null;
                            }
                        } elseif ($ruleType === 'update_field') {
                            $field = $rule['config']['field'] ?? null;
                            $value = $rule['config']['value'] ?? null;
                            if ($field) {
                                if (in_array($field, ['priority', 'title', 'description'])) {
                                    $updates[$field] = $value;
                                } elseif ($field === 'assignee_id') {
                                    $updates['assignee_id'] = $value && (int)$value > 0 ? (int)$value : null;
                                // H7 FIX: creator_id removed — immutable after task creation
                                } elseif ($field === 'start_date') {
                                    $updates['start_date'] = $value ?: null;
                                } elseif ($field === 'labels') {
                                    if ($value) {
                                        $task->labels()->sync([$value]);
                                    } else {
                                        $task->labels()->detach();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        $recurrenceConfigChanged = false;
        if ($request->has('is_recurring') && $request->input('is_recurring') != $task->is_recurring) {
            $recurrenceConfigChanged = true;
        }
        foreach (['recurring_frequency', 'recurring_interval', 'recurring_weekdays', 'recurring_monthday', 'recurring_time'] as $field) {
            if ($request->has($field) && $request->input($field) != $task->$field) {
                if ($field === 'recurring_weekdays') {
                    $oldWeekdays = is_array($task->recurring_weekdays) ? $task->recurring_weekdays : [];
                    $newWeekdays = $request->input('recurring_weekdays') ?: [];
                    if (array_diff($oldWeekdays, $newWeekdays) || array_diff($newWeekdays, $oldWeekdays)) {
                        $recurrenceConfigChanged = true;
                    }
                } else {
                    $recurrenceConfigChanged = true;
                }
            }
        }

        $task->update($updates);

        if ($recurrenceConfigChanged) {
            if ($task->is_recurring) {
                $task->recurring_next_trigger = $task->calculateNextTriggerDate();
            } else {
                $task->recurring_next_trigger = null;
            }
            $task->save();
        }

        // Load relations before checking assignee change details
        $task->load(['assignee', 'creator', 'labels']);

        // Log activities
        $userId = $request->user()->id;
        if ($task->title !== $oldTitle) {
            $this->logActivity($task->id, $userId, 'updated_title', "Updated title to '{$task->title}'");
        }

        if ($task->status !== $oldStatus) {
            $this->logActivity($task->id, $userId, 'updated_status', "Changed status from '{$oldStatus}' to '{$task->status}'");
            // Notify assignee of status change
            if ($task->assignee_id) {
                Notification::notify(
                    $task->assignee_id,
                    $userId,
                    'status_changed',
                    'changed status of',
                    $task->title,
                    "{$oldStatus} → {$task->status}",
                    $task->id,
                    $task->project_id
                );
            }
            // Notify watchers of status change
            $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];
            foreach ($watchers as $watcherId) {
                if ($watcherId !== $userId && $watcherId !== $task->assignee_id) {
                    Notification::notify(
                        $watcherId,
                        $userId,
                        'status_changed',
                        'changed status of',
                        $task->title,
                        "{$oldStatus} → {$task->status}",
                        $task->id,
                        $task->project_id
                    );
                }
            }
        }

        if ($task->assignee_id !== $oldAssigneeId) {
            // Stop any running timer for the old assignee on this task
            if ($oldAssigneeId) {
                $runningEntry = TimeEntry::where('task_id', $task->id)
                    ->where('user_id', $oldAssigneeId)
                    ->whereNull('ended_at')
                    ->first();
                if ($runningEntry) {
                    $runningEntry->ended_at = now();
                    $runningEntry->duration = abs($runningEntry->ended_at->diffInSeconds($runningEntry->started_at));
                    $runningEntry->save();

                    // Log activity
                    $durationStr = $this->formatDuration($runningEntry->duration);
                    $this->logActivity($task->id, $userId, 'stopped_timer', "Stopped timer due to task reassignment. Logged {$durationStr}.");

                    // Broadcast update
                    event(new TimeTrackingUpdated((int)$task->project_id, (int)$oldAssigneeId, 'stopped', $runningEntry->toArray()));
                }
            }

            $oldAssigneeName = null;
            if ($oldAssigneeId) {
                $oldAssignee = User::find($oldAssigneeId);
                if ($oldAssignee) {
                    $oldAssigneeName = $oldAssignee->name;
                }
            }
            $detail = $task->assignee 
                ? "Assigned task to {$task->assignee->name}." 
                : ($oldAssigneeName ? "Unassigned task from {$oldAssigneeName}." : "Unassigned task.");
            $this->logActivity($task->id, $userId, 'updated_assignee', $detail);
            // Notify new assignee
            if ($task->assignee_id) {
                Notification::notify(
                    $task->assignee_id,
                    $userId,
                    'task_assigned',
                    'assigned you a task',
                    $task->title,
                    null,
                    $task->id,
                    $task->project_id
                );
            }

            // Remove the new assignee from watchers if they were in the list
            if ($task->assignee_id) {
                $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];
                if (in_array((int)$task->assignee_id, $watchers)) {
                    $watchers = array_values(array_filter($watchers, fn($uid) => (int)$uid !== (int)$task->assignee_id));
                    $task->update(['watcher_ids' => $watchers]);
                }
            }
            // Notify watchers of assignee change
            $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];
            foreach ($watchers as $watcherId) {
                if ($watcherId !== $userId && $watcherId !== $task->assignee_id) {
                    Notification::notify(
                        $watcherId,
                        $userId,
                        'status_changed',
                        $task->assignee ? "assigned task to {$task->assignee->name}" : "unassigned task",
                        $task->title,
                        null,
                        $task->id,
                        $task->project_id
                    );
                }
            }
        }

        if ($task->estimated_hours !== $oldEst) {
            $this->logActivity($task->id, $userId, 'updated_estimated_hours', "Updated estimated hours to " . ($task->estimated_hours ?? 0) . "h");
        }
        if ($task->actual_hours !== $oldAct) {
            $this->logActivity($task->id, $userId, 'updated_actual_hours', "Updated actual hours to " . ($task->actual_hours ?? 0) . "h");
        }
        if ($task->description !== $oldDescription) {
            $this->logActivity($task->id, $userId, 'updated_description', "Updated description.");
        }
        if ($task->priority !== $oldPriority) {
            $this->logActivity($task->id, $userId, 'updated_priority', "Changed priority to '{$task->priority}'");
        }
        
        $oldStartStr = $oldStartDate ? \Carbon\Carbon::parse($oldStartDate)->toDateTimeString() : null;
        $newStartStr = $task->start_date ? \Carbon\Carbon::parse($task->start_date)->toDateTimeString() : null;
        if ($oldStartStr !== $newStartStr) {
            $formattedStart = $task->start_date ? date('d-m-Y H:i', strtotime($task->start_date)) : 'none';
            $this->logActivity($task->id, $userId, 'updated_start_date', "Changed start date to {$formattedStart}");
        }

        $oldDueStr = $oldDueDate ? \Carbon\Carbon::parse($oldDueDate)->toDateTimeString() : null;
        $newDueStr = $task->due_date ? \Carbon\Carbon::parse($task->due_date)->toDateTimeString() : null;
        if ($oldDueStr !== $newDueStr) {
            $formattedDue = $task->due_date ? date('d-m-Y H:i', strtotime($task->due_date)) : 'none';
            $this->logActivity($task->id, $userId, 'updated_due_date', "Changed due date to {$formattedDue}");
        }

        Log::info("User ID {$userId} ({$request->user()->name}) updated Task ID {$task->id} ({$task->title})");

        $broadcastPayload = [
            'id'           => (int) $task->id,
            'project_id'   => (int) $task->project_id,
            'title'        => $task->title,
            'status'       => $task->status,
            'priority'     => $task->priority,
            'type'         => $task->type,
            'assignee_id'  => $task->assignee_id,
            'creator_id'   => $task->creator_id,
            'start_date'   => $task->start_date,
            'due_date'     => $task->due_date,
            'completed_at' => $task->completed_at,
            'position'     => $task->position,
            'watcher_ids'  => $task->watcher_ids,
            'is_recurring' => (bool) $task->is_recurring,
            'recurring_frequency' => $task->recurring_frequency,
            'recurring_interval' => (int) $task->recurring_interval,
            'recurring_weekdays' => $task->recurring_weekdays,
            'recurring_monthday' => $task->recurring_monthday ? (int) $task->recurring_monthday : null,
            'recurring_next_trigger' => $task->recurring_next_trigger ? $task->recurring_next_trigger->toIso8601String() : null,
            'recurring_time' => $task->recurring_time,
            'assignee'     => $task->assignee ? [
                'id'    => $task->assignee->id,
                'name'  => $task->assignee->name,
                'photo' => $task->assignee->photo,
            ] : null,
            'creator'      => $task->creator ? [
                'id'    => $task->creator->id,
                'name'  => $task->creator->name,
                'photo' => $task->creator->photo,
            ] : null,
        ];
        event(new TaskUpdated((int)$task->project_id, 'updated', $broadcastPayload));

        return response()->json([
            'success' => true,
            'message' => 'Task updated successfully',
            'data' => $task,
        ]);
    }

    /**
     * Remove the specified task.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        $isAuthorized = ($user->role === 'admin' || $project->created_by === $user->id || $isProjectManager || $task->creator_id === $user->id);

        if (!$isAuthorized) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this task',
            ], 403);
        }

        $projectId = (int)$task->project_id;
        $taskId = (int)$task->id;
        $task->delete();

        event(new TaskUpdated($projectId, 'deleted', ['id' => $taskId]));

        Log::info("User ID {$request->user()->id} ({$request->user()->name}) deleted Task ID {$id}");

        return response()->json([
            'success' => true,
            'message' => 'Task deleted successfully',
        ]);
    }

    /**
     * Drag & Drop Quick update status and position in columns.
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|string',
            'position' => 'nullable|integer|min:0',
        ]);

        $task = Task::find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        $isAuthorized = ($user->role === 'admin' || $project->created_by === $user->id || $isProjectManager);

        if (!$isAuthorized) {
            $isOwnTask = ($task->creator_id === $user->id || $task->assignee_id === $user->id);
            $isProjectMember = $project->members->contains($user->id);

            if (!$isProjectMember || !$isOwnTask) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to update this task',
                ], 403);
            }
        }

        $newStatus = $request->input('status');
        $newPosition = $request->input('position', 0);

        // Workflow transition validation
        if ($newStatus !== $task->status) {
            $workflowError = $this->checkWorkflowTransition($task, $newStatus, $user);
            if ($workflowError) {
                return $workflowError;
            }
        }

        $oldStatus = $task->status;

        DB::transaction(function () use ($task, $project, $newStatus, $newPosition, $user) {
            // Shift positions of other tasks in the target column
            Task::where('project_id', $task->project_id)
                ->where('status', $newStatus)
                ->where('position', '>=', $newPosition)
                ->increment('position');

            $projectStatuses = $project->statuses;
            
            $newIsClosed = false;
            foreach ($projectStatuses as $s) {
                if ($s['id'] === $newStatus && in_array($s['type'] ?? '', ['closed', 'done'])) {
                    $newIsClosed = true;
                    break;
                }
            }

            $oldIsClosed = false;
            foreach ($projectStatuses as $s) {
                if ($s['id'] === $task->status && in_array($s['type'] ?? '', ['closed', 'done'])) {
                    $oldIsClosed = true;
                    break;
                }
            }

            $updates = [
                'status' => $newStatus,
                'position' => $newPosition,
            ];

            if ($newIsClosed && !$oldIsClosed) {
                $updates['completed_at'] = now();
            } elseif (!$newIsClosed && $oldIsClosed) {
                $updates['completed_at'] = null;
            }

            // Apply workflow post-action rules
            $workflow = $project->workflow;
            if (($workflow['mode'] ?? 'unrestricted') === 'restricted') {
                $transitions = $workflow['transitions'] ?? [];
                $globalTransitions = $workflow['global_transitions'] ?? [];
                $matchedTransition = null;

                foreach ($transitions as $t) {
                    if (($t['from'] ?? '') === $task->status && ($t['to'] ?? '') === $newStatus) {
                        $matchedTransition = $t;
                        break;
                    }
                }

                if (!$matchedTransition) {
                    foreach ($globalTransitions as $gt) {
                        if (($gt['to'] ?? '') === $newStatus) {
                            $matchedTransition = $gt;
                            break;
                        }
                    }
                }

                if ($matchedTransition && !empty($matchedTransition['rules'])) {
                    foreach ($matchedTransition['rules'] as $rule) {
                        $ruleType = $rule['type'] ?? '';
                        if ($ruleType === 'assign_user') {
                            if (($rule['config']['to'] ?? '') === 'current_user') {
                                $updates['assignee_id'] = $user->id;
                            } elseif (($rule['config']['to'] ?? '') === 'clear') {
                                $updates['assignee_id'] = null;
                            }
                        } elseif ($ruleType === 'update_field') {
                            $field = $rule['config']['field'] ?? null;
                            $value = $rule['config']['value'] ?? null;
                            if ($field) {
                                if (in_array($field, ['priority', 'title', 'description'])) {
                                    $updates[$field] = $value;
                                } elseif ($field === 'assignee_id') {
                                    $updates['assignee_id'] = $value && (int)$value > 0 ? (int)$value : null;
                                // H7 FIX: creator_id removed — immutable after task creation
                                } elseif ($field === 'start_date') {
                                    $updates['start_date'] = $value ?: null;
                                } elseif ($field === 'labels') {
                                    if ($value) {
                                        $task->labels()->sync([$value]);
                                    } else {
                                        $task->labels()->detach();
                                    }
                                }
                            }
                        }
                    }
                }
            }

            $task->update($updates);
        });

        if ($newStatus !== $oldStatus) {
            $this->logActivity($task->id, $request->user()->id, 'updated_status', "Changed status from '{$oldStatus}' to '{$newStatus}'");
        }

        Log::info("User ID {$request->user()->id} ({$request->user()->name}) updated Task ID {$task->id} status/position to {$newStatus}/{$newPosition}");

        $loadedTask = $task->load(['assignee', 'creator', 'labels']);
        $broadcastPayload = [
            'id'           => (int) $loadedTask->id,
            'project_id'   => (int) $loadedTask->project_id,
            'title'        => $loadedTask->title,
            'status'       => $loadedTask->status,
            'priority'     => $loadedTask->priority,
            'type'         => $loadedTask->type,
            'assignee_id'  => $loadedTask->assignee_id,
            'creator_id'   => $loadedTask->creator_id,
            'start_date'   => $loadedTask->start_date,
            'due_date'     => $loadedTask->due_date,
            'completed_at' => $loadedTask->completed_at,
            'position'     => $loadedTask->position,
            'watcher_ids'  => $loadedTask->watcher_ids,
            'assignee'     => $loadedTask->assignee ? [
                'id'    => $loadedTask->assignee->id,
                'name'  => $loadedTask->assignee->name,
                'photo' => $loadedTask->assignee->photo,
            ] : null,
            'creator'      => $loadedTask->creator ? [
                'id'    => $loadedTask->creator->id,
                'name'  => $loadedTask->creator->name,
                'photo' => $loadedTask->creator->photo,
            ] : null,
        ];
        event(new TaskUpdated((int)$task->project_id, 'updated', $broadcastPayload));

        return response()->json([
            'success' => true,
            'message' => 'Task status updated successfully',
            'data' => $loadedTask,
        ]);
    }

    /**
     * Store comment with optional proof file/image attachment.
     */
    public function storeComment(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to comment on this task',
            ], 403);
        }

        $request->validate([
            'comment' => 'required_without:attachment|nullable|string',
            'attachment' => 'nullable|file|image|max:10240', // max 10MB
            'parent_id' => 'nullable|integer|exists:task_comments,id',
        ]);

        $user = $request->user();
        $attachmentPath = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $originalName = $file->getClientOriginalName();
            $filename = time() . '_' . \Illuminate\Support\Str::random(8) . '_' . str_replace(' ', '_', $originalName);
            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 'local') {
                $disk = 'public';
            }
            $path = $file->storeAs('task_attachments', $filename, $disk);
            $attachmentPath = $disk === 's3' ? Storage::disk('s3')->url($path) : '/storage/' . $path;
        }

        $comment = TaskComment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'parent_id' => $request->input('parent_id'),
            'comment' => $request->input('comment') ?? '',
            'attachment_path' => $attachmentPath,
        ]);

        $this->logActivity($task->id, $user->id, 'commented', "Posted a comment: \"" . substr($comment->comment, 0, 50) . "...\"");

        $parentComment = null;
        $replyAuthorId = null;
        if ($request->input('parent_id')) {
            $parentComment = TaskComment::find($request->input('parent_id'));
            if ($parentComment) {
                $replyAuthorId = $parentComment->user_id;
            }
        }

        $notifiedUserIds = [];

        // 1. Notify reply author
        if ($replyAuthorId && $replyAuthorId !== $user->id) {
            $notifiedUserIds[] = $replyAuthorId;
            Notification::notify(
                $replyAuthorId,
                $user->id,
                'reply',
                'replied to your comment on',
                $task->title,
                substr($comment->comment, 0, 80),
                $task->id,
                $task->project_id
            );
        }

        // 2. Parse and notify mentions like @[Admin Phi]
        $mentionedUserIds = [];
        if (preg_match_all('/@\[([^\]]+)\]/', $comment->comment, $matches)) {
            $usernames = array_unique($matches[1]);
            $mentionedUsers = User::whereIn('name', $usernames)->get();
            foreach ($mentionedUsers as $mUser) {
                if ($mUser->id !== $user->id && !in_array($mUser->id, $notifiedUserIds)) {
                    $notifiedUserIds[] = $mUser->id;
                    $mentionedUserIds[] = $mUser->id;
                    Notification::notify(
                        $mUser->id,
                        $user->id,
                        'mention',
                        'mentioned you on',
                        $task->title,
                        substr($comment->comment, 0, 80),
                        $task->id,
                        $task->project_id
                    );
                }
            }
        }

        // 3. Notify task assignee about the comment/reply
        if ($task->assignee_id && $task->assignee_id !== $user->id && !in_array($task->assignee_id, $notifiedUserIds)) {
            $notifiedUserIds[] = $task->assignee_id;
            Notification::notify(
                $task->assignee_id,
                $user->id,
                $replyAuthorId ? 'reply' : 'comment',
                $replyAuthorId ? 'replied to a comment on' : 'commented on',
                $task->title,
                substr($comment->comment, 0, 80),
                $task->id,
                $task->project_id
            );
        }

        // 4. Notify task creator if different
        if ($task->creator_id && $task->creator_id !== $user->id && !in_array($task->creator_id, $notifiedUserIds)) {
            $notifiedUserIds[] = $task->creator_id;
            Notification::notify(
                $task->creator_id,
                $user->id,
                $replyAuthorId ? 'reply' : 'comment',
                $replyAuthorId ? 'replied to a comment on' : 'commented on',
                $task->title,
                substr($comment->comment, 0, 80),
                $task->id,
                $task->project_id
            );
        }

        // 5. Notify other watchers
        $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];
        foreach ($watchers as $watcherId) {
            if ($watcherId !== $user->id && !in_array($watcherId, $notifiedUserIds)) {
                $notifiedUserIds[] = $watcherId;
                Notification::notify(
                    $watcherId,
                    $user->id,
                    $replyAuthorId ? 'reply' : 'comment',
                    $replyAuthorId ? 'replied to a comment on' : 'commented on',
                    $task->title,
                    substr($comment->comment, 0, 80),
                    $task->id,
                    $task->project_id
                );
            }
        }
        $loadedComment = $comment->load('user');
        event(new TaskUpdated((int)$task->project_id, 'comment_created', [
            'task_id' => (int)$task->id,
            'comment' => $loadedComment->toArray()
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Comment added successfully',
            'data' => $loadedComment,
        ]);
    }

    /**
     * Check if a possible ancestor task is a descendant of the current task.
     */
    private function isDescendantOf($taskId, $possibleAncestorId): bool
    {
        $current = Task::find($possibleAncestorId);
        while ($current && $current->parent_task_id) {
            if ($current->parent_task_id == $taskId) {
                return true;
            }
            $current = Task::find($current->parent_task_id);
        }
        return false;
    }

    private function checkWorkflowTransition(Task $task, string $newStatus, $user): ?JsonResponse
    {
        $project = $task->project;
        $failedRules = [];

        // Check for task dependencies (blockers) if transitioning to active/closed status
        $projectStatuses = $project->statuses;
        $newStatusInfo = collect($projectStatuses)->firstWhere('id', $newStatus);
        $newStatusType = $newStatusInfo['type'] ?? 'active';

        if ($newStatusType !== 'not_started') {
            $blockerTaskIds = DB::table('task_dependencies')
                ->where(function($q) use ($task) {
                    $q->where('target_task_id', $task->id)->where('type', 'blocks');
                })
                ->orWhere(function($q) use ($task) {
                    $q->where('task_id', $task->id)->where('type', 'blocked_by');
                })
                ->get()
                ->map(function($dep) use ($task) {
                    return $dep->type === 'blocks' ? $dep->task_id : $dep->target_task_id;
                })
                ->toArray();

            if (!empty($blockerTaskIds)) {
                $incompleteBlockers = Task::whereIn('id', $blockerTaskIds)
                    ->whereNull('completed_at')
                    ->get();

                if ($incompleteBlockers->isNotEmpty()) {
                    $blockerTitles = $incompleteBlockers->pluck('title')->implode(', ');
                    $failedRules[] = [
                        'type' => 'dependency',
                        'message' => "Không thể chuyển trạng thái công việc này vì nó đang bị chặn bởi công việc chưa hoàn thành: {$blockerTitles}.",
                        'details' => [
                            'blocker_tasks' => $incompleteBlockers->map(fn($t) => [
                                'id' => $t->id,
                                'title' => $t->title,
                                'status' => $t->status,
                            ])->values()->toArray()
                        ]
                    ];
                }
            }
        }

        // Checklist check if transitioning to closed status
        if ($newStatusType === 'closed') {
            $checklistItems = DB::table('checklist_items')
                ->join('checklists', 'checklist_items.checklist_id', '=', 'checklists.id')
                ->where('checklists.task_id', $task->id)
                ->select('checklist_items.id', 'checklist_items.name', 'checklist_items.is_checked')
                ->get();

            $totalCount = $checklistItems->count();
            if ($totalCount > 0) {
                $uncheckedItems = $checklistItems->where('is_checked', false);
                $checkedCount = $totalCount - $uncheckedItems->count();

                if ($uncheckedItems->isNotEmpty()) {
                    $failedRules[] = [
                        'type' => 'checklist',
                        'message' => "Checklist chưa hoàn thành (Đã xong {$checkedCount}/{$totalCount}).",
                        'details' => [
                            'total_items' => $totalCount,
                            'checked_items' => $checkedCount,
                            'unchecked_items' => $uncheckedItems->map(fn($item) => [
                                'id' => $item->id,
                                'name' => $item->name,
                            ])->values()->toArray(),
                        ]
                    ];
                }
            }
        }

        // I8: Use task-type-specific workflow if available
        $wfModel = $project->getWorkflowForTaskType($task->type);
        $workflow = $project->workflow; // keeps backward-compat array format

        $transitions = $workflow['transitions'] ?? [];
        $globalTransitions = $workflow['global_transitions'] ?? [];

        $userProjectRole = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->value('role') ?? 'member';

        $availableTransitions = $project->getAvailableTransitions(
            $task->status,
            $userProjectRole,
            $user->role === 'admin',
            $user->id,
            $task
        );

        $allowedStatusIds = array_map(fn($t) => $t['to'], $availableTransitions);

        $statusNames = collect($project->statuses)->pluck('name', 'id')->toArray();
        $oldStatusName = $statusNames[$task->status] ?? $task->status;
        $newStatusName = $statusNames[$newStatus] ?? $newStatus;

        $hasPathError = false;
        if (($workflow['mode'] ?? 'unrestricted') === 'restricted' && !empty($transitions) && !in_array($newStatus, $allowedStatusIds)) {
            $failedRules[] = [
                'type' => 'transition_path',
                'message' => "Không thể chuyển trạng thái từ '{$oldStatusName}' sang '{$newStatusName}' theo quy tắc workflow của dự án.",
                'details' => [
                    'old_status' => $task->status,
                    'old_status_name' => $oldStatusName,
                    'new_status' => $newStatus,
                    'new_status_name' => $newStatusName,
                ]
            ];
            $hasPathError = true;
        }

        // Get matched transition
        $matchedTransition = null;
        if (!$hasPathError) {
            foreach ($transitions as $t) {
                if (($t['from'] ?? '') === $task->status && ($t['to'] ?? '') === $newStatus) {
                    $matchedTransition = $t;
                    break;
                }
            }

            if (!$matchedTransition) {
                foreach ($globalTransitions as $gt) {
                    if (($gt['to'] ?? '') === $newStatus) {
                        $matchedTransition = $gt;
                        break;
                    }
                }
            }
        }

        // Fetch the Eloquent WorkflowTransition model for new fields
        $transitionModel = null;
        if ($wfModel && $matchedTransition) {
            $transitionKey = $matchedTransition['id'] ?? null;
            if ($transitionKey) {
                $transitionModel = $wfModel->transitionsRelation()
                    ->where('transition_key', $transitionKey)
                    ->first();
            }
        }

        // Check allowed_task_roles
        if ($transitionModel) {
            $allowedTaskRoles = $transitionModel->allowed_task_roles ?? [];
            if (!empty($allowedTaskRoles)) {
                $taskAssigneeRole = TaskAssignee::where('task_id', $task->id)
                    ->where('user_id', $user->id)
                    ->value('role');

                $isManagerOrAdmin = in_array($user->role, ['manager', 'admin', 'superadmin'])
                    || $userProjectRole === 'manager'
                    || (int)$project->created_by === (int)$user->id;

                if (!$isManagerOrAdmin && !in_array($taskAssigneeRole, $allowedTaskRoles)) {
                    $failedRules[] = [
                        'type' => 'task_role',
                        'message' => 'Bạn không có vai trò công việc phù hợp để thực hiện transition này.',
                        'details' => [
                            'allowed_task_roles' => $allowedTaskRoles,
                            'your_task_role' => $taskAssigneeRole,
                        ]
                    ];
                }
            }
        }

        if ($matchedTransition && !empty($matchedTransition['rules'])) {
            foreach ($matchedTransition['rules'] as $rule) {
                $ruleType = $rule['type'] ?? '';
                if ($ruleType === 'restrict_subtasks') {
                    $requiredStatus = $rule['config']['status'] ?? 'done';
                    // Check if all subtasks have this status
                    $subtasksCount = Task::where('parent_task_id', $task->id)->count();
                    if ($subtasksCount > 0) {
                        $unfinishedSubtasks = Task::where('parent_task_id', $task->id)
                            ->where('status', '!=', $requiredStatus)
                            ->get();
                        if ($unfinishedSubtasks->isNotEmpty()) {
                            $requiredStatusName = $statusNames[$requiredStatus] ?? $requiredStatus;
                            $failedRules[] = [
                                'type' => 'restrict_subtasks',
                                'message' => "Tất cả công việc con phải ở trạng thái '{$requiredStatusName}' trước khi chuyển đổi trạng thái công việc cha sang '{$newStatusName}'.",
                                'details' => [
                                    'required_status' => $requiredStatus,
                                    'required_status_name' => $requiredStatusName,
                                    'unfinished_count' => $unfinishedSubtasks->count(),
                                    'subtasks' => $unfinishedSubtasks->map(fn($t) => [
                                        'id' => $t->id,
                                        'title' => $t->title,
                                        'status' => $t->status,
                                    ])->values()->toArray()
                                ]
                            ];
                        }
                    }
                } elseif ($ruleType === 'restrict_field') {
                    $field = $rule['config']['field'] ?? null;
                    $value = $rule['config']['value'] ?? null;
                    if ($field) {
                        $isRestricted = false;

                        // Check proposed value in request if present, fallback to current task state
                        $proposedValue = $task->{$field} ?? null;
                        if ($field === 'priority') {
                            $proposedValue = request()->input('priority', $task->priority);
                            if ($proposedValue !== $value) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'assignee_id') {
                            $proposedValue = request()->has('assignee_id') ? request()->input('assignee_id') : $task->assignee_id;
                            $taskVal = $proposedValue ? (int)$proposedValue : 0;
                            $reqVal = (int)$value;
                            if ($taskVal !== $reqVal) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'creator_id') {
                            $proposedValue = request()->input('creator_id', $task->creator_id);
                            $taskVal = $proposedValue ? (int)$proposedValue : 0;
                            $reqVal = (int)$value;
                            if ($taskVal !== $reqVal) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'title') {
                            $proposedValue = request()->input('title', $task->title);
                            if ($proposedValue !== $value) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'description') {
                            $proposedValue = request()->input('description', $task->description);
                            if ($proposedValue !== $value) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'start_date') {
                            $proposedValue = request()->has('start_date') ? request()->input('start_date') : $task->start_date;
                            $taskDate = $proposedValue ? (is_string($proposedValue) ? substr($proposedValue, 0, 10) : $proposedValue->format('Y-m-d')) : '';
                            $valDate = $value ? substr($value, 0, 10) : '';
                            if ($taskDate !== $valDate) {
                                $isRestricted = true;
                            }
                        } elseif ($field === 'labels') {
                            $labelIds = $task->labels->pluck('id')->map('strval')->toArray();
                            if (!in_array(strval($value), $labelIds)) {
                                $isRestricted = true;
                            }
                        }

                        if ($isRestricted) {
                            $fieldLabel = [
                                'priority' => 'Độ ưu tiên',
                                'assignee_id' => 'Người thực hiện',
                                'creator_id' => 'Người báo cáo',
                                'title' => 'Tiêu đề',
                                'description' => 'Mô tả',
                                'start_date' => 'Ngày bắt đầu',
                                'labels' => 'Nhãn'
                            ][$field] ?? $field;

                            // Lookup user name or label name if applicable
                            $reqValName = $value;
                            if ($field === 'assignee_id' || $field === 'creator_id') {
                                if ((int)$value === 0) {
                                    $reqValName = 'Trống (không gán)';
                                } else {
                                    $requiredUser = User::find($value);
                                    $reqValName = $requiredUser ? $requiredUser->name : $value;
                                }
                            } elseif ($field === 'labels') {
                                $requiredLabel = \App\Models\Label::find($value);
                                $reqValName = $requiredLabel ? $requiredLabel->name : $value;
                            } elseif ($field === 'priority') {
                                $priorityLabels = [
                                    'urgent' => 'Khẩn cấp',
                                    'high' => 'Cao',
                                    'medium' => 'Trung bình',
                                    'low' => 'Thấp',
                                ];
                                $reqValName = $priorityLabels[$value] ?? $value;
                            }

                            $failedRules[] = [
                                'type' => 'restrict_field',
                                'message' => "Trường '{$fieldLabel}' phải được thiết lập là '{$reqValName}' trước khi chuyển đổi sang trạng thái '{$newStatusName}'.",
                                'details' => [
                                    'field' => $field,
                                    'field_label' => $fieldLabel,
                                    'required_value' => $value,
                                    'required_value_label' => $reqValName,
                                    'current_value' => $task->{$field} ?? null,
                                ]
                            ];
                        }
                    }
                } elseif ($ruleType === 'restrict_role') {
                    $type = $rule['config']['type'] ?? 'manager';
                    $userIds = $rule['config']['userIds'] ?? [];

                    $isAllowed = false;
                    if ($user->role === 'admin' || (int)$project->created_by === (int)$user->id) {
                        $isAllowed = true;
                    } elseif ($type === 'manager') {
                        $isAllowed = ($userProjectRole === 'manager');
                    } elseif ($type === 'all') {
                        $isAllowed = true;
                    } elseif ($type === 'flexible') {
                        $isAllowed = in_array((int)$user->id, array_map('intval', $userIds));
                    }

                    if (!$isAllowed) {
                        $roleText = '';
                        if ($type === 'manager') {
                            $roleText = "chỉ dành cho Quản lý dự án (Manager)";
                        } elseif ($type === 'flexible') {
                            $allowedUsers = User::whereIn('id', $userIds)->pluck('name')->toArray();
                            $roleText = "chỉ dành cho các thành viên: " . implode(', ', $allowedUsers);
                        } else {
                            $roleText = "bị hạn chế quyền hạn";
                        }
                        $failedRules[] = [
                            'type' => 'restrict_role',
                            'message' => "Bạn không có quyền thực hiện chuyển đổi này (yêu cầu: {$roleText}).",
                            'details' => [
                                'role_type' => $type,
                                'role_text' => $roleText,
                            ]
                        ];
                    }
                }
            }
        }

        if (!empty($failedRules)) {
            $topLevelMessage = count($failedRules) === 1 
                ? $failedRules[0]['message'] 
                : 'Không thể chuyển trạng thái công việc. Vui lòng hoàn tất các yêu cầu trước.';

            return response()->json([
                'success' => false,
                'message' => $topLevelMessage,
                'workflow_error' => true,
                'failed_rules' => $failedRules,
            ], 422);
        }

        // I1: Check require_all_reviewers if no other rules failed
        if ($transitionModel && $transitionModel->require_all_reviewers) {
            $reviewers = TaskAssignee::where('task_id', $task->id)
                ->where('role', 'reviewer')
                ->get();

            if ($reviewers->isNotEmpty()) {
                $transitionKey = $transitionModel->transition_key;

                foreach ($reviewers as $reviewer) {
                    TaskApproval::firstOrCreate(
                        [
                            'task_id' => $task->id,
                            'transition_key' => $transitionKey,
                            'reviewer_id' => $reviewer->user_id,
                        ],
                        ['status' => 'pending']
                    );
                    // Notify reviewer
                    Notification::notify(
                        $reviewer->user_id,
                        $user->id,
                        'task_assigned',
                        'requested your review on',
                        $task->title,
                        null,
                        $task->id,
                        $task->project_id
                    );
                }

                // Block transition – return 202 Accepted (pending approval)
                $approvals = TaskApproval::where('task_id', $task->id)
                    ->where('transition_key', $transitionKey)
                    ->with('reviewer')
                    ->get();

                return response()->json([
                    'message' => 'Transition đang chờ review. Notification đã được gửi đến reviewers.',
                    'pending' => true,
                    'approvals' => $approvals,
                ], 202);
            }
        }
        return null;
    }

    /**
     * Helper to log activity.
     */
    private function logActivity($taskId, $userId, $action, $details = null)
    {
        TaskActivity::create([
            'task_id' => $taskId,
            'user_id' => $userId,
            'action' => $action,
            'details' => $details,
        ]);
    }

    /**
     * Helper to format seconds to human readable duration.
     */
    private function formatDuration($seconds)
    {
        $seconds = abs($seconds);
        $h = floor($seconds / 3600);
        $m = floor(($seconds % 3600) / 60);
        $s = $seconds % 60;

        $parts = [];
        if ($h > 0) $parts[] = "{$h}h";
        if ($m > 0) $parts[] = "{$m}m";
        if ($s > 0 || empty($parts)) $parts[] = "{$s}s";

        return implode(' ', $parts);
    }

    /**
     * Helper to calculate working minutes between two dates.
     */
    private function calculateWorkingMinutes($startDate, $dueDate): int
    {
        if (!$startDate || !$dueDate) {
            return 0;
        }

        $start = \Carbon\Carbon::parse($startDate)->setTimezone('Asia/Ho_Chi_Minh');
        $due = \Carbon\Carbon::parse($dueDate)->setTimezone('Asia/Ho_Chi_Minh');

        if ($due->lessThanOrEqualTo($start)) {
            return 0;
        }

        $startDateKey = $start->toDateString();
        $dueDateKey = $due->toDateString();

        if ($startDateKey === $dueDateKey) {
            $dayOfWeek = $start->dayOfWeek; // 0 (Sunday) to 6 (Saturday)
            $startMin = $start->hour * 60 + $start->minute;
            $dueMin = $due->hour * 60 + $due->minute;

            return $this->getWorkingMinutesForDay($dayOfWeek, $startMin, $dueMin);
        }

        $totalMinutes = 0;
        $current = $start->copy()->startOfDay();
        $dueStartOfDay = $due->copy()->startOfDay();

        while ($current->lessThanOrEqualTo($dueStartOfDay)) {
            $currentDateKey = $current->toDateString();
            $dayOfWeek = $current->dayOfWeek;

            $startMin = 0;
            $endMin = 24 * 60;

            if ($currentDateKey === $startDateKey) {
                $startMin = $start->hour * 60 + $start->minute;
            }
            if ($currentDateKey === $dueDateKey) {
                $endMin = $due->hour * 60 + $due->minute;
            }

            $totalMinutes += $this->getWorkingMinutesForDay($dayOfWeek, $startMin, $endMin);
            
            $current->addDay();
        }

        return $totalMinutes;
    }

    private function getWorkingMinutesForDay(int $dayOfWeek, int $startMin, int $endMin): int
    {
        if ($dayOfWeek === \Carbon\Carbon::SUNDAY) {
            return 0;
        }
        if ($dayOfWeek === \Carbon\Carbon::SATURDAY) {
            // Saturday: 8:00 (480) - 12:00 (720)
            return max(0, min($endMin, 720) - max($startMin, 480));
        }
        // Monday to Friday: 8:00 - 12:00 (480 to 720) and 13:00 - 17:00 (780 to 1020)
        $overlap1 = max(0, min($endMin, 720) - max($startMin, 480));
        $overlap2 = max(0, min($endMin, 1020) - max($startMin, 780));
        return $overlap1 + $overlap2;
    }

    /**
     * POST /api/comments/{id}/react
     * React to a task comment (like, love, haha, wow, sad, angry)
     */
    public function reactToComment(Request $request, $id): JsonResponse
    {
        $comment = TaskComment::find($id);
        if (!$comment) {
            return response()->json([
                'success' => false,
                'message' => 'Comment not found',
            ], 404);
        }

        $user = $request->user();
        $task = $comment->task;
        if ($task) {
            $project = $task->project;
            if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to react to comments in this project',
                ], 403);
            }
        }

        $request->validate([
            'reaction' => 'required|string|in:like,love,haha,wow,sad,angry',
        ]);

        $user = $request->user();
        $reactionType = $request->input('reaction');

        // Check if user already reacted
        $existing = CommentReaction::where('comment_id', $comment->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->reaction === $reactionType) {
                // If clicked the exact same reaction, remove it (unlike)
                $existing->delete();
                $message = 'Reaction removed';
            } else {
                // Update reaction
                $existing->update(['reaction' => $reactionType]);
                $message = 'Reaction updated';

                // Notify comment author
                if ($comment->user_id !== $user->id && $task) {
                    Notification::notify(
                        $comment->user_id,
                        $user->id,
                        'reaction',
                        'reacted to your comment on',
                        $task->title,
                        substr($comment->comment, 0, 80),
                        $task->id,
                        $task->project_id
                    );
                }
            }
        } else {
            // Create reaction
            CommentReaction::create([
                'comment_id' => $comment->id,
                'user_id' => $user->id,
                'reaction' => $reactionType,
            ]);
            $message = 'Reaction added';

            // Notify comment author
            if ($comment->user_id !== $user->id && $task) {
                Notification::notify(
                    $comment->user_id,
                    $user->id,
                    'reaction',
                    'reacted to your comment on',
                    $task->title,
                    substr($comment->comment, 0, 80),
                    $task->id,
                    $task->project_id
                );
            }
        }

        // Get updated reactions
        $reactions = $comment->reactions()->get();

        if ($task) {
            event(new TaskUpdated((int)$task->project_id, 'comment_reacted', [
                'task_id' => (int)$task->id,
                'comment_id' => (int)$comment->id,
                'reactions' => $reactions->toArray()
            ]));
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $reactions,
        ]);
    }

    /**
     * POST /api/tasks/{id}/watch
     */
    public function toggleWatch(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);

        if (!$task) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $user = $request->user();

        // Check if user is project member or admin
        $isProjectMember = \Illuminate\Support\Facades\DB::table('project_members')
            ->where('project_id', $task->project_id)
            ->where('user_id', $user->id)
            ->exists();

        if ($user->role !== 'admin' && !$isProjectMember) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to watch tasks in this project',
            ], 403);
        }

        $targetUserId = (int)$request->input('user_id', $user->id);
        $targetUser = User::find($targetUserId);
        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'Target user not found',
            ], 404);
        }

        if ($task->assignee_id && (int)$task->assignee_id === $targetUserId) {
            return response()->json([
                'success' => false,
                'message' => 'Người thực hiện không thể theo dõi công việc của chính mình',
            ], 400);
        }

        $isTargetProjectMember = \Illuminate\Support\Facades\DB::table('project_members')
            ->where('project_id', $task->project_id)
            ->where('user_id', $targetUserId)
            ->exists();

        if ($targetUser->role !== 'admin' && !$isTargetProjectMember) {
            return response()->json([
                'success' => false,
                'message' => 'Target user is not a member of this project',
            ], 400);
        }

        $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];

        if (in_array($targetUserId, $watchers)) {
            // Remove user from watchers
            $watchers = array_values(array_filter($watchers, fn($uid) => $uid !== $targetUserId));
            $watched = false;
        } else {
            // Add user to watchers
            $watchers[] = $targetUserId;
            $watched = true;
        }

        $task->update(['watcher_ids' => $watchers]);

        if ($watched && $targetUserId !== $user->id) {
            Notification::notify(
                $targetUserId,
                $user->id,
                'task_assigned',
                'đã thêm bạn làm người theo dõi công việc',
                $task->title,
                null,
                $task->id,
                $task->project_id
            );
        }

        return response()->json([
            'success' => true,
            'watched' => $watched,
            'watcher_ids' => $watchers,
        ]);
    }

    /**
     * Start a timer for a task.
     */
    public function startTimer(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to track time on this task',
            ], 403);
        }

        if (!$task->assignee_id) {
            $lang = $request->header('X-Language', 'vi');
            $msg = $lang === 'en'
                ? 'Cannot track time on an unassigned task. Please assign the task first.'
                : 'Không thể ghi nhận thời gian cho công việc chưa được gán cho ai. Vui lòng gán công việc trước.';
            return response()->json([
                'success' => false,
                'message' => $msg,
            ], 400);
        }

        if ((int)$task->assignee_id !== (int)$user->id) {
            $lang = $request->header('X-Language', 'vi');
            $msg = $lang === 'en'
                ? 'You can only track time on tasks assigned to you.'
                : 'Bạn chỉ có thể ghi nhận thời gian trên công việc được gán cho chính bạn.';
            return response()->json([
                'success' => false,
                'message' => $msg,
            ], 403);
        }

        // Check if user already has a running timer on this task
        $running = TimeEntry::where('task_id', $id)
            ->where('user_id', $user->id)
            ->whereNull('ended_at')
            ->first();

        if ($running) {
            return response()->json([
                'success' => false,
                'message' => 'Timer is already running for this task',
                'data' => $running,
            ], 409);
        }

        // Stop any other running timers for this user
        $anyRunning = TimeEntry::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->get();

        foreach ($anyRunning as $oldEntry) {
            $oldEntry->ended_at = now();
            $oldEntry->duration = abs($oldEntry->ended_at->diffInSeconds($oldEntry->started_at));
            $oldEntry->save();
            
            $durationStr = $this->formatDuration($oldEntry->duration);
            $this->logActivity($oldEntry->task_id, $user->id, 'stopped_timer', "Stopped timer (due to starting timer on another task). Logged {$durationStr}.");

            $oldTask = Task::find($oldEntry->task_id);
            if ($oldTask) {
                event(new TimeTrackingUpdated((int)$oldTask->project_id, (int)$user->id, 'stopped', $oldEntry->toArray()));
            }
        }

        $entry = TimeEntry::create([
            'task_id' => $id,
            'user_id' => $user->id,
            'started_at' => now(),
            'duration' => 0,
        ]);

        $this->logActivity($id, $user->id, 'started_timer', 'Started timer.');

        $entry->load(['user', 'task.project']);
        event(new TimeTrackingUpdated((int)$task->project_id, (int)$user->id, 'started', $entry->toArray()));

        return response()->json([
            'success' => true,
            'data' => $entry,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Stop the running timer for a task.
     */
    public function stopTimer(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();

        if ((int)$task->assignee_id !== (int)$user->id) {
            $lang = $request->header('X-Language', 'vi');
            $msg = $lang === 'en'
                ? 'You can only stop timers on tasks assigned to you.'
                : 'Bạn chỉ có thể dừng đếm giờ trên công việc được gán cho chính bạn.';
            return response()->json([
                'success' => false,
                'message' => $msg,
            ], 403);
        }

        $entry = TimeEntry::where('task_id', $id)
            ->where('user_id', $user->id)
            ->whereNull('ended_at')
            ->first();

        if (!$entry) {
            return response()->json([
                'success' => false,
                'message' => 'No running timer found for this task',
            ], 404);
        }

        $entry->ended_at = now();
        $entry->duration = abs($entry->ended_at->diffInSeconds($entry->started_at));
        $entry->save();
        $entry->load(['user', 'task.project']);

        $durationStr = $this->formatDuration($entry->duration);
        $this->logActivity($entry->task_id, $user->id, 'stopped_timer', "Stopped timer. Logged {$durationStr}.");

        $task = $entry->task;
        if ($task) {
            event(new TimeTrackingUpdated((int)$task->project_id, (int)$user->id, 'stopped', $entry->toArray()));
        }

        return response()->json([
            'success' => true,
            'data' => $entry,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Add a manual time entry for a task.
     */
    public function addManualTime(Request $request, $id): JsonResponse
    {
        $task = Task::find($id);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to track time on this task',
            ], 403);
        }

        if (!$task->assignee_id) {
            $lang = $request->header('X-Language', 'vi');
            $msg = $lang === 'en'
                ? 'Cannot track time on an unassigned task. Please assign the task first.'
                : 'Không thể ghi nhận thời gian cho công việc chưa được gán cho ai. Vui lòng gán công việc trước.';
            return response()->json([
                'success' => false,
                'message' => $msg,
            ], 400);
        }

        if ((int)$task->assignee_id !== (int)$user->id) {
            $lang = $request->header('X-Language', 'vi');
            $msg = $lang === 'en'
                ? 'You can only track time on tasks assigned to you.'
                : 'Bạn chỉ có thể ghi nhận thời gian trên công việc được gán cho chính bạn.';
            return response()->json([
                'success' => false,
                'message' => $msg,
            ], 403);
        }

        $request->validate([
            'duration' => 'required|integer|min:1', // seconds
            'description' => 'nullable|string|max:500',
            'started_at' => 'nullable|date',
        ]);
        $startedAt = $request->input('started_at') ? new \Carbon\Carbon($request->input('started_at')) : now();
        $duration = $request->input('duration');

        $entry = TimeEntry::create([
            'task_id' => $id,
            'user_id' => $user->id,
            'started_at' => $startedAt,
            'ended_at' => $startedAt->copy()->addSeconds($duration),
            'duration' => $duration,
            'description' => $request->input('description'),
        ]);

        $durationStr = $this->formatDuration($duration);
        $desc = $request->input('description');
        $details = "Manually added {$durationStr}." . ($desc ? " Note: {$desc}" : "");
        $this->logActivity($id, $user->id, 'added_time', $details);

        $entry->load('user');

        return response()->json([
            'success' => true,
            'data' => $entry,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Delete a time entry.
     */
    public function deleteTimeEntry(Request $request, $id): JsonResponse
    {
        $entry = TimeEntry::find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Time entry not found'], 404);
        }

        $user = $request->user();
        if ($entry->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $taskId = $entry->task_id;
        $durationStr = $this->formatDuration($entry->duration);
        $entry->delete();

        $this->logActivity($taskId, $user->id, 'deleted_time', "Deleted time log {$durationStr}.");

        return response()->json([
            'success' => true,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get the user's currently running timer (if any).
     */
    public function getRunningTimer(Request $request): JsonResponse
    {
        $user = $request->user();
        $running = TimeEntry::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->with('task.project')
            ->first();

        return response()->json([
            'success' => true,
            'data' => $running,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get the user's logged time entries for today.
     */
    public function getTodayTimeEntries(Request $request): JsonResponse
    {
        $user = $request->user();
        $entries = TimeEntry::where('user_id', $user->id)
            ->whereDate('started_at', \Carbon\Carbon::today())
            ->with('task.project')
            ->orderBy('started_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $entries,
        ]);
    }

    /**
     * Soft delete/mask a comment by its author.
     */
    public function deleteComment(Request $request, $id): JsonResponse
    {
        $comment = TaskComment::find($id);
        if (!$comment) {
            return response()->json(['success' => false, 'message' => 'Comment not found'], 404);
        }

        $user = $request->user();

        // Only the comment author or admin can delete it
        if ($user->role !== 'admin' && (int)$comment->user_id !== (int)$user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized to delete this comment'], 403);
        }

        // Delete physical attachment if it exists
        if ($comment->attachment_path) {
            $filePath = $comment->attachment_path;
            if (!str_starts_with($filePath, 'http://') && !str_starts_with($filePath, 'https://')) {
                $relativePath = str_replace('/storage/', '', $filePath);
                if (\Illuminate\Support\Facades\Storage::disk('public')->exists($relativePath)) {
                    \Illuminate\Support\Facades\Storage::disk('public')->delete($relativePath);
                }
            }
        }

        // Leave a trace text
        $comment->update([
            'comment' => 'Bình luận này đã bị xóa',
            'attachment_path' => null,
        ]);

        $loadedComment = $comment->load('user');
        
        // Broadcast the update so other clients receive the change
        $task = $comment->task;
        if ($task) {
            event(new TaskUpdated((int)$task->project_id, 'comment_updated', [
                'task_id' => (int)$task->id,
                'comment' => $loadedComment->toArray()
            ]));
        }

        return response()->json([
            'success' => true,
            'message' => 'Bình luận đã được xóa.',
            'data' => $loadedComment,
        ]);
    }

    /**
     * GET /api/tasks/{id}/comments?page=1&per_page=15
     * Paginated comments for a task.
     */
    public function getComments(Request $request, $taskId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $perPage = min((int) $request->input('per_page', 15), 50);
        $page = max((int) $request->input('page', 1), 1);

        $total = TaskComment::where('task_id', $taskId)->count();

        $comments = TaskComment::where('task_id', $taskId)
            ->with(['user', 'reactions'])
            ->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $comments,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'has_more' => ($page * $perPage) < $total,
            ],
        ]);
    }

    /**
     * GET /api/tasks/{id}/activities?page=1&per_page=20
     * Paginated activity logs for a task.
     */
    public function getActivities(Request $request, $taskId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $perPage = min((int) $request->input('per_page', 20), 50);
        $page = max((int) $request->input('page', 1), 1);

        $total = TaskActivity::where('task_id', $taskId)->count();

        $activities = TaskActivity::where('task_id', $taskId)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $activities,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'has_more' => ($page * $perPage) < $total,
            ],
        ]);
    }

    /**
     * Get a list of time entries filtered by user, date range, or project.
     */
    public function getTimeEntriesList(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $query = TimeEntry::query()->with(['task.project', 'user']);

        // Date filters
        if ($request->has('start_date')) {
            $query->where('started_at', '>=', $request->input('start_date'));
        }
        if ($request->has('end_date')) {
            $query->where('started_at', '<=', $request->input('end_date'));
        }

        // User filter
        $targetUserId = $request->input('user_id');
        if ($targetUserId && $targetUserId !== 'all') {
            // Non-admins/non-managers can only see their own time entries
            if ($user->role !== 'admin' && $user->role !== 'manager' && (int)$targetUserId !== (int)$user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to view other users\' timesheets',
                ], 403);
            }
            $query->where('user_id', $targetUserId);
        } else {
            // If user_id is 'all' or omitted, check permissions for viewing all
            $viewAll = $targetUserId === 'all' || $request->boolean('view_all', false);
            if ($viewAll && ($user->role === 'admin' || $user->role === 'manager')) {
                // Fetch all users' entries
            } else {
                $query->where('user_id', $user->id);
            }
        }

        // Project filter
        if ($request->has('project_id')) {
            $projectId = $request->input('project_id');
            $query->whereHas('task', function ($q) use ($projectId) {
                $q->where('project_id', $projectId);
            });
        }

        $entries = $query->orderBy('started_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $entries,
        ]);
    }

    /**
     * POST /api/tasks/{id}/clone
     */
    public function cloneTask(Request $request, $id): JsonResponse
    {
        $originalTask = Task::with(['labels', 'customFieldValues', 'checklists.items'])->find($id);
        if (!$originalTask) {
            return response()->json([
                'success' => false,
                'message' => 'Task not found',
            ], 404);
        }

        $project = $originalTask->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to clone task in this project',
            ], 403);
        }

        $projectStatuses = $project->statuses;
        $workflowInitialStatus = $project->workflow()->value('initial_status');
        $firstStatusId = $projectStatuses[0]['id'] ?? 'todo';
        $status = $workflowInitialStatus ? $workflowInitialStatus : $firstStatusId;

        $maxPosition = Task::where('project_id', $originalTask->project_id)
            ->where('status', $status)
            ->max('position') ?? 0;

        $clonedTask = Task::create([
            'project_id' => $originalTask->project_id,
            'title' => 'Nhân bản của ' . $originalTask->title,
            'description' => $originalTask->description,
            'status' => $status,
            'priority' => $originalTask->priority ?? 'medium',
            'type' => $originalTask->type ?? 'task',
            'assignee_id' => $originalTask->assignee_id,
            'creator_id' => $user->id,
            'estimated_hours' => $originalTask->estimated_hours ?? 0,
            'actual_hours' => 0,
            'start_date' => $originalTask->start_date,
            'due_date' => $originalTask->due_date,
            'completed_at' => null,
            'parent_task_id' => $originalTask->parent_task_id,
            'position' => $maxPosition + 1,
        ]);

        // Clone Labels (Sync many-to-many)
        if ($originalTask->labels->isNotEmpty()) {
            $clonedTask->labels()->sync($originalTask->labels->pluck('id'));
        }

        // Clone Custom Field Values
        foreach ($originalTask->customFieldValues as $val) {
            $clonedTask->customFieldValues()->create([
                'custom_field_id' => $val->custom_field_id,
                'value' => $val->value,
            ]);
        }

        // Clone Checklists & Items
        foreach ($originalTask->checklists as $list) {
            $newList = $clonedTask->checklists()->create([
                'name' => $list->name,
                'position' => $list->position,
            ]);
            foreach ($list->items as $item) {
                $newList->items()->create([
                    'name' => $item->name,
                    'is_checked' => $item->is_checked,
                    'assignee_id' => $item->assignee_id,
                    'position' => $item->position,
                ]);
            }
        }

        // Create Task Dependency: Cloned task CLONES Original task
        TaskDependency::create([
            'task_id' => $clonedTask->id,
            'target_task_id' => $originalTask->id,
            'type' => 'clones',
            'created_by' => $user->id,
        ]);

        // Log Activity on both tasks
        $this->logActivity($originalTask->id, $user->id, 'linked_task', "Task này được nhân bản bởi #{$clonedTask->id} '{$clonedTask->title}'");
        $this->logActivity($clonedTask->id, $user->id, 'created', "Công việc này được tạo từ việc nhân bản #{$originalTask->id} '{$originalTask->title}'");

        Log::info("User ID {$user->id} cloned Task ID {$originalTask->id} to Task ID {$clonedTask->id}");

        // Broadcast/Event trigger
        $loadedTask = $clonedTask->load(['assignee', 'creator', 'labels', 'dependencies', 'inverseDependencies']);
        event(new TaskUpdated((int)$clonedTask->project_id, 'created', $loadedTask->toArray()));

        // Also broadcast update for original task because dependencies relationship changed
        $loadedOriginalTask = $originalTask->fresh(['dependencies', 'inverseDependencies']);
        event(new TaskUpdated((int)$originalTask->project_id, 'updated', $loadedOriginalTask->toArray()));

        return response()->json([
            'success' => true,
            'message' => 'Công việc đã được nhân bản thành công.',
            'data' => $loadedTask,
        ]);
    }
}

