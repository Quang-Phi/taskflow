<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Milestone;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MilestoneController extends Controller
{
    public function index(Request $request, $projectId): JsonResponse
    {
        $status = $request->query('status');
        $query = Milestone::where('project_id', $projectId);

        if ($status) {
            $query->where('status', $status);
        }

        $milestones = $query->orderBy('due_date', 'asc')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($milestone) {
                // Fetch tasks for this milestone to calculate metrics
                $tasks = Task::where('milestone_id', $milestone->id)->get();
                
                $totalTasks = $tasks->count();
                $completedTasks = $tasks->filter(fn($t) => !is_null($t->completed_at))->count();
                $totalHours = (float)$tasks->sum('estimated_hours');
                $completedHours = (float)$tasks->filter(fn($t) => !is_null($t->completed_at))->sum('estimated_hours');

                $milestone->tasks_count = $totalTasks;
                $milestone->completed_tasks_count = $completedTasks;
                $milestone->total_estimated_hours = $totalHours;
                $milestone->completed_estimated_hours = $completedHours;

                return $milestone;
            });

        return response()->json([
            'success' => true,
            'data' => $milestones,
        ]);
    }

    public function store(Request $request, $projectId): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'status' => 'required|string|in:planned,active,completed,cancelled',
            'goal' => 'nullable|string',
        ]);

        $status = $request->input('status', 'planned');
        $completedAt = ($status === 'completed') ? now() : null;

        $milestone = Milestone::create([
            'project_id' => $projectId,
            'name' => $request->input('name'),
            'description' => $request->input('description'),
            'start_date' => $request->input('start_date'),
            'due_date' => $request->input('due_date'),
            'status' => $status,
            'goal' => $request->input('goal'),
            'created_by' => $request->user()->id,
            'completed_at' => $completedAt,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Milestone created successfully',
            'data' => $milestone,
        ]);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $milestone = Milestone::with(['tasks.assignee', 'tasks.creator', 'creator'])->find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        // Calculate progress stats
        $tasks = $milestone->tasks;
        $totalTasks = $tasks->count();
        $completedTasks = $tasks->filter(fn($t) => !is_null($t->completed_at))->count();
        $totalHours = (float)$tasks->sum('estimated_hours');
        $completedHours = (float)$tasks->filter(fn($t) => !is_null($t->completed_at))->sum('estimated_hours');

        $milestone->tasks_count = $totalTasks;
        $milestone->completed_tasks_count = $completedTasks;
        $milestone->total_estimated_hours = $totalHours;
        $milestone->completed_estimated_hours = $completedHours;

        return response()->json([
            'success' => true,
            'data' => $milestone,
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $milestone = Milestone::find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'status' => 'sometimes|required|string|in:planned,active,completed,cancelled',
            'goal' => 'nullable|string',
        ]);

        $oldStatus = $milestone->status;
        $newStatus = $request->input('status', $oldStatus);

        $completedAt = $milestone->completed_at;
        if ($newStatus === 'completed' && $oldStatus !== 'completed') {
            $completedAt = now();
        } elseif ($newStatus !== 'completed' && $oldStatus === 'completed') {
            $completedAt = null;
        }

        $milestone->update(array_merge($request->only([
            'name', 'description', 'start_date', 'due_date', 'status', 'goal'
        ]), [
            'completed_at' => $completedAt
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Milestone updated successfully',
            'data' => $milestone,
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $milestone = Milestone::find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        $milestone->delete();

        return response()->json([
            'success' => true,
            'message' => 'Milestone deleted successfully',
        ]);
    }

    public function assignTasks(Request $request, $id): JsonResponse
    {
        $milestone = Milestone::find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        $request->validate([
            'task_ids' => 'required|array',
            'task_ids.*' => 'exists:tasks,id',
        ]);

        $taskIds = $request->input('task_ids');

        // Update tasks milestone_id where they belong to the same project
        Task::whereIn('id', $taskIds)
            ->where('project_id', $milestone->project_id)
            ->update(['milestone_id' => $milestone->id]);

        return response()->json([
            'success' => true,
            'message' => 'Tasks assigned to milestone successfully',
        ]);
    }

    public function removeTasks(Request $request, $id): JsonResponse
    {
        $milestone = Milestone::find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        $request->validate([
            'task_ids' => 'required|array',
            'task_ids.*' => 'exists:tasks,id',
        ]);

        $taskIds = $request->input('task_ids');

        Task::whereIn('id', $taskIds)
            ->where('milestone_id', $milestone->id)
            ->update(['milestone_id' => null]);

        return response()->json([
            'success' => true,
            'message' => 'Tasks removed from milestone successfully',
        ]);
    }

    public function burndown(Request $request, $id): JsonResponse
    {
        $milestone = Milestone::find($id);

        if (!$milestone) {
            return response()->json([
                'success' => false,
                'message' => 'Milestone not found',
            ], 404);
        }

        // Set start and due date boundaries
        $startDate = $milestone->start_date ? Carbon::parse($milestone->start_date)->startOfDay() : Carbon::parse($milestone->created_at)->startOfDay();
        $dueDate = $milestone->due_date ? Carbon::parse($milestone->due_date)->endOfDay() : $startDate->copy()->addDays(14)->endOfDay();

        // Calculate total days in range
        $totalDays = $startDate->diffInDays($dueDate) + 1;
        if ($totalDays <= 1) {
            $totalDays = 2; // Avoid division by zero
        }

        // Fetch all tasks in this milestone
        $tasks = Task::where('milestone_id', $milestone->id)->get();
        $totalTasksCount = $tasks->count();
        $totalHours = (float)$tasks->sum('estimated_hours');

        $chartData = [];
        $current = $startDate->copy();
        $dayIndex = 0;
        $today = Carbon::now()->endOfDay();

        while ($current->startOfDay() <= $dueDate->startOfDay()) {
            $dateStr = $current->format('Y-m-d');

            // Ideal Burndown calculations (linear projection from total to 0)
            $idealTasks = round($totalTasksCount * (1 - ($dayIndex / ($totalDays - 1))), 2);
            $idealHours = round($totalHours * (1 - ($dayIndex / ($totalDays - 1))), 2);

            // If day is today or in the past, calculate actual values
            if ($current->startOfDay() <= $today->startOfDay()) {
                // A task is remaining at $current if it is not completed yet, or completed AFTER $current->endOfDay()
                $remainingTasks = $tasks->filter(function ($task) use ($current) {
                    if (is_null($task->completed_at)) {
                        return true;
                    }
                    return Carbon::parse($task->completed_at)->greaterThan($current->copy()->endOfDay());
                });

                $actualTasks = $remainingTasks->count();
                $actualHours = (float)$remainingTasks->sum('estimated_hours');
            } else {
                // Do not plot actual values in the future
                $actualTasks = null;
                $actualHours = null;
            }

            $chartData[] = [
                'date' => $dateStr,
                'ideal_tasks' => max(0, $idealTasks),
                'actual_tasks' => $actualTasks,
                'ideal_hours' => max(0.0, $idealHours),
                'actual_hours' => $actualHours,
            ];

            $current->addDay();
            $dayIndex++;
        }

        return response()->json([
            'success' => true,
            'data' => $chartData,
        ]);
    }
}
