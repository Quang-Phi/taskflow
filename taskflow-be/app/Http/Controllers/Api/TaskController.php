<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\Project;
use App\Models\TaskComment;
use App\Models\CommentReaction;
use App\Models\TaskActivity;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\Notification;
use App\Events\TaskUpdated;
use App\Events\TimeTrackingUpdated;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        $query = Task::with(['assignee', 'creator', 'labels', 'project.members', 'timeEntries.user']);

        if ($request->has('project_id')) {
            $query->where('project_id', $request->input('project_id'));
            if ($request->input('include_subtasks') !== 'true') {
                $query->whereNull('parent_task_id');
            }
        }

        if ($request->has('assignee_id')) {
            $query->where('assignee_id', $request->input('assignee_id'));
        }

        if ($user->role !== 'admin') {
            $query->whereHas('project', function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
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
            'assignee_id' => 'nullable|exists:users,id',
            'estimated_hours' => 'nullable|integer|min:0',
            'actual_hours' => 'nullable|integer|min:0',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'parent_task_id' => 'nullable|exists:tasks,id',
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

        $projectStatuses = $project->statuses;
        $defaultStatusId = $projectStatuses[0]['id'] ?? 'todo';
        $status = $request->input('status', $defaultStatusId);

        // Validate status exists in project
        $validStatusIds = array_column($projectStatuses, 'id');
        if (!in_array($status, $validStatusIds) && $status !== $defaultStatusId) {
            return response()->json([
                'success' => false,
                'message' => 'Trạng thái không hợp lệ.',
            ], 422);
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
            $start = \Carbon\Carbon::parse($startDate);
            $due = \Carbon\Carbon::parse($dueDate);
            if ($due->greaterThan($start)) {
                $est = (int)round($due->diffInMinutes($start) / 60);
            } else {
                $est = 0;
            }
        }

        $task = Task::create([
            'project_id' => $projectId,
            'title' => $request->input('title'),
            'description' => $request->input('description'),
            'status' => $status,
            'priority' => $request->input('priority', 'medium'),
            'assignee_id' => $request->input('assignee_id'),
            'creator_id' => $request->user()->id,
            'estimated_hours' => $est,
            'actual_hours' => $request->input('actual_hours'),
            'start_date' => $startDate,
            'due_date' => $dueDate,
            'completed_at' => $isClosed ? now() : null,
            'parent_task_id' => $request->input('parent_task_id'),
            'position' => $maxPosition + 1,
        ]);

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

        return response()->json([
            'success' => true,
            'data' => $task,
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
        }

        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|in:urgent,high,medium,low',
            'assignee_id' => 'nullable|exists:users,id',
            'estimated_hours' => 'nullable|integer|min:0',
            'actual_hours' => 'nullable|integer|min:0',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'parent_task_id' => 'nullable|exists:tasks,id',
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
            'assignee_id',
            'estimated_hours',
            'actual_hours',
            'start_date',
            'due_date',
            'parent_task_id',
        ]);

        if ($request->has('start_date') || $request->has('due_date')) {
            $finalStartDate = $request->has('start_date') ? $request->input('start_date') : $task->start_date;
            $finalDueDate = $request->has('due_date') ? $request->input('due_date') : $task->due_date;
            if ($finalStartDate && $finalDueDate) {
                $start = \Carbon\Carbon::parse($finalStartDate);
                $due = \Carbon\Carbon::parse($finalDueDate);
                if ($due->greaterThan($start)) {
                    $updates['estimated_hours'] = (int)round(abs($due->diffInMinutes($start)) / 60);
                } else {
                    $updates['estimated_hours'] = 0;
                }
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
        }

        $task->update($updates);

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

        event(new TaskUpdated((int)$task->project_id, 'updated', $task->toArray()));

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

        $oldStatus = $task->status;

        DB::transaction(function () use ($task, $project, $newStatus, $newPosition) {
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

            $task->update($updates);
        });

        $this->logActivity($task->id, $request->user()->id, 'updated_status', "Changed status from '{$oldStatus}' to '{$newStatus}'");

        Log::info("User ID {$request->user()->id} ({$request->user()->name}) updated Task ID {$task->id} status/position to {$newStatus}/{$newPosition}");

        $loadedTask = $task->load(['assignee', 'creator', 'labels']);
        event(new TaskUpdated((int)$task->project_id, 'updated', $loadedTask->toArray()));

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
            'comment' => 'required|string',
            'attachment' => 'nullable|file|image|max:10240', // max 10MB
            'parent_id' => 'nullable|integer|exists:task_comments,id',
        ]);

        $user = $request->user();
        $attachmentPath = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $filename = time() . '_' . $file->getClientOriginalName();
            $path = $file->storeAs('task_attachments', $filename, 'public');
            $attachmentPath = '/storage/' . $path; // Public url link
        }

        $comment = TaskComment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'parent_id' => $request->input('parent_id'),
            'comment' => $request->input('comment'),
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

    /**
     * Help validate sequential transitions.
     */
    private function validateStatusTransition($oldStatus, $newStatus): bool
    {
        if ($oldStatus === $newStatus) {
            return true;
        }

        $allowed = [
            'todo' => ['in_progress'],
            'in_progress' => ['review'],
            'review' => ['done'],
            'done' => [],
        ];

        return in_array($newStatus, $allowed[$oldStatus] ?? []);
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

        $watchers = is_array($task->watcher_ids) ? $task->watcher_ids : [];

        if (in_array($user->id, $watchers)) {
            // Remove user from watchers
            $watchers = array_values(array_filter($watchers, fn($uid) => $uid !== $user->id));
            $watched = false;
        } else {
            // Add user to watchers
            $watchers[] = $user->id;
            $watched = true;
        }

        $task->update(['watcher_ids' => $watchers]);

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
        ]);
    }

    /**
     * Stop the running timer for a task.
     */
    public function stopTimer(Request $request, $id): JsonResponse
    {
        $user = $request->user();

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

        $request->validate([
            'duration' => 'required|integer|min:1', // seconds
            'description' => 'nullable|string|max:500',
            'started_at' => 'nullable|date',
        ]);

        $user = $request->user();
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

        return response()->json(['success' => true]);
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
}

