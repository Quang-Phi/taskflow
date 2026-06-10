<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskAssignee;
use App\Models\TaskApproval;
use App\Models\Notification;
use App\Models\TaskActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TaskAssigneeController extends Controller
{
    /**
     * GET /api/tasks/{task}/assignees
     * List all assignees (and reviewers/reporters) of a task.
     */
    public function index(Request $request, $taskId): JsonResponse
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

        $assignees = TaskAssignee::where('task_id', $task->id)
            ->with('user')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $assignees,
        ]);
    }

    /**
     * POST /api/tasks/{task}/assignees
     * Add an assignee / reviewer / reporter to a task.
     */
    public function store(Request $request, $taskId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json(['success' => false, 'message' => 'Unauthorized – only managers/admins can manage task assignees'], 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role' => 'nullable|in:assignee,reviewer,reporter',
        ]);

        $role = $request->input('role', 'assignee');

        // Enforce uniqueness per task-user combination
        $existing = TaskAssignee::where('task_id', $task->id)
            ->where('user_id', $request->input('user_id'))
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'User already has a role on this task',
                'data' => $existing->load('user'),
            ], 409);
        }

        $taskAssignee = TaskAssignee::create([
            'task_id' => $task->id,
            'user_id' => $request->input('user_id'),
            'role' => $role,
            'assigned_at' => now(),
        ]);

        // Notify user about assignment/review request
        if (in_array($role, ['assignee', 'reviewer'])) {
            $action = $role === 'reviewer' ? 'requested your review on' : 'assigned you to';
            Notification::notify(
                $taskAssignee->user_id,
                $user->id,
                'task_assigned',
                $action,
                $task->title,
                null,
                $task->id,
                $task->project_id
            );
        }

        // Log activity
        $roleLabel = ['assignee' => 'assignee', 'reviewer' => 'reviewer', 'reporter' => 'reporter'][$role] ?? $role;
        TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'added_' . $role,
            'details' => "Added {$taskAssignee->user->name} as {$roleLabel}.",
        ]);

        Log::info("User ID {$user->id} added User ID {$taskAssignee->user_id} as {$role} to Task ID {$task->id}");

        return response()->json([
            'success' => true,
            'message' => 'User added to task successfully',
            'data' => $taskAssignee->load('user'),
        ], 201);
    }

    /**
     * PUT /api/tasks/{task}/assignees/{userId}
     * Change the role of an existing task assignee.
     */
    public function update(Request $request, $taskId, $userId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'role' => 'required|in:assignee,reviewer,reporter',
        ]);

        $taskAssignee = TaskAssignee::where('task_id', $task->id)
            ->where('user_id', $userId)
            ->first();

        if (!$taskAssignee) {
            return response()->json(['success' => false, 'message' => 'This user is not assigned to the task'], 404);
        }

        $oldRole = $taskAssignee->role;
        $taskAssignee->update(['role' => $request->input('role')]);

        TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'changed_role',
            'details' => "Changed {$taskAssignee->user->name}'s role from {$oldRole} to {$taskAssignee->role}.",
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Role updated successfully',
            'data' => $taskAssignee->load('user'),
        ]);
    }

    /**
     * DELETE /api/tasks/{task}/assignees/{userId}
     * Remove a user from task assignees.
     */
    public function destroy(Request $request, $taskId, $userId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;

        $isProjectManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isProjectManager) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $taskAssignee = TaskAssignee::where('task_id', $task->id)
            ->where('user_id', $userId)
            ->first();

        if (!$taskAssignee) {
            return response()->json(['success' => false, 'message' => 'This user is not assigned to the task'], 404);
        }

        // If removing a reviewer, cancel their pending approvals
        if ($taskAssignee->role === 'reviewer') {
            TaskApproval::where('task_id', $task->id)
                ->where('reviewer_id', $userId)
                ->where('status', 'pending')
                ->delete();
        }

        $removedName = $taskAssignee->user->name ?? "User #{$userId}";
        $removedRole = $taskAssignee->role;

        $taskAssignee->delete();

        TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'removed_' . $removedRole,
            'details' => "Removed {$removedName} from task (was {$removedRole}).",
        ]);

        Log::info("User ID {$user->id} removed User ID {$userId} ({$removedRole}) from Task ID {$task->id}");

        return response()->json([
            'success' => true,
            'message' => 'User removed from task successfully',
        ]);
    }
}
