<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskAssignee;
use App\Models\TaskApproval;
use App\Models\Notification;
use App\Models\TaskActivity;
use App\Models\Workflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TaskApprovalController extends Controller
{
    /**
     * GET /api/tasks/{task}/approvals
     * List pending (or all) approvals for a task.
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

        $query = TaskApproval::where('task_id', $task->id)->with('reviewer');

        // Filter by transition_key if provided
        if ($request->filled('transition_key')) {
            $query->where('transition_key', $request->input('transition_key'));
        }

        // Filter by status if provided (default: all)
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $approvals = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $approvals,
        ]);
    }

    /**
     * POST /api/tasks/{task}/approvals
     * Reviewer submits an approve or reject decision.
     */
    public function store(Request $request, $taskId): JsonResponse
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

        $request->validate([
            'transition_key' => 'required|string',
            'status' => 'required|in:approved,rejected',
            'comment' => 'nullable|string|max:2000',
        ]);

        $transitionKey = $request->input('transition_key');

        // Verify caller is a reviewer on this task
        $isReviewer = TaskAssignee::where('task_id', $task->id)
            ->where('user_id', $user->id)
            ->where('role', 'reviewer')
            ->exists();

        if (!$isReviewer && $user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không phải là reviewer của task này.',
            ], 403);
        }

        // Find the pending approval record for this reviewer & transition
        $approval = TaskApproval::where('task_id', $task->id)
            ->where('transition_key', $transitionKey)
            ->where('reviewer_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy yêu cầu review đang chờ xử lý cho bạn trên transition này.',
            ], 404);
        }

        // Update the approval record
        $approval->update([
            'status' => $request->input('status'),
            'comment' => $request->input('comment'),
            'decided_at' => now(),
        ]);

        $decision = $request->input('status');

        // Log activity
        $decisionLabel = $decision === 'approved' ? 'approved' : 'rejected';
        TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'review_' . $decision,
            'details' => "Review {$decisionLabel} for transition '{$transitionKey}'."
                . ($request->input('comment') ? " Comment: " . substr($request->input('comment'), 0, 100) : ''),
        ]);

        if ($decision === 'rejected') {
            // Notify assignee about rejection
            if ($task->assignee_id) {
                Notification::notify(
                    $task->assignee_id,
                    $user->id,
                    'status_changed',
                    'rejected your review request on',
                    $task->title,
                    $request->input('comment') ? substr($request->input('comment'), 0, 80) : null,
                    $task->id,
                    $task->project_id
                );
            }

            Log::info("User ID {$user->id} rejected review for Task ID {$task->id} (transition: {$transitionKey})");

            return response()->json([
                'success' => true,
                'message' => 'Review rejected.',
                'data' => $approval->fresh()->load('reviewer'),
            ]);
        }

        // Decision is 'approved' – check if we should auto-transition
        $wfModel = $project->getWorkflowForTaskType($task->type);
        $transitionModel = null;
        if ($wfModel) {
            $transitionModel = $wfModel->transitionsRelation()
                ->where('transition_key', $transitionKey)
                ->first();
        }

        $requireAll = $transitionModel?->require_all_reviewers ?? true;

        if ($requireAll) {
            // Check if ALL reviewers have approved
            $pendingCount = TaskApproval::where('task_id', $task->id)
                ->where('transition_key', $transitionKey)
                ->where('status', 'pending')
                ->count();

            if ($pendingCount > 0) {
                // More approvals needed – just return current state
                $allApprovals = TaskApproval::where('task_id', $task->id)
                    ->where('transition_key', $transitionKey)
                    ->with('reviewer')
                    ->get();

                return response()->json([
                    'success' => true,
                    'message' => 'Approval recorded. Waiting for remaining reviewers.',
                    'pending_count' => $pendingCount,
                    'data' => $allApprovals,
                ]);
            }
        }

        // All required approvals received (or require_all_reviewers = false) → auto-transition
        if ($transitionModel) {
            $newStatus = $transitionModel->to;
            $currentStatus = $task->status;

            if ($newStatus && $newStatus !== $currentStatus) {
                $task->update(['status' => $newStatus]);

                // Update completed_at if needed
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
                    if ($s['id'] === $currentStatus && in_array($s['type'] ?? '', ['closed', 'done'])) {
                        $oldIsClosed = true;
                        break;
                    }
                }

                if ($newIsClosed && !$oldIsClosed) {
                    $task->update(['completed_at' => now()]);
                } elseif (!$newIsClosed && $oldIsClosed) {
                    $task->update(['completed_at' => null]);
                }

                TaskActivity::create([
                    'task_id' => $task->id,
                    'user_id' => $user->id,
                    'action' => 'updated_status',
                    'details' => "Auto-transitioned status from '{$currentStatus}' to '{$newStatus}' after all reviews approved.",
                ]);

                // Notify assignee about auto-transition
                if ($task->assignee_id) {
                    Notification::notify(
                        $task->assignee_id,
                        $user->id,
                        'status_changed',
                        'approved your review and moved',
                        $task->title,
                        "{$currentStatus} → {$newStatus}",
                        $task->id,
                        $task->project_id
                    );
                }

                Log::info("Task ID {$task->id} auto-transitioned to '{$newStatus}' after all reviews approved (transition: {$transitionKey})");
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Approved. Task status has been updated.',
            'data' => $approval->fresh()->load('reviewer'),
            'task' => $task->fresh()->load(['assignee', 'creator', 'labels']),
        ]);
    }
}
