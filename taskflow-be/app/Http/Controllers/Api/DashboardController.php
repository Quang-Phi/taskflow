<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/stats
     * Returns all dashboard widgets data in a single request.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;
        $now = Carbon::now();

        // ──────────────────────────────────────────────
        // 1. Overview stat cards
        // ──────────────────────────────────────────────
        if ($user->role !== 'admin') {
            $totalProjects = Project::where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            })->count();
        } else {
            $totalProjects = Project::count();
        }
        $activeTasks = Task::where('assignee_id', $userId)
            ->whereNull('completed_at')
            ->whereNull('deleted_at')
            ->count();
        $overdueTasks = Task::where('assignee_id', $userId)
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now)
            ->whereNull('completed_at')
            ->whereNull('deleted_at')
            ->count();
        $completedTasks = Task::where('assignee_id', $userId)
            ->whereNotNull('completed_at')
            ->whereNull('deleted_at')
            ->count();

        // ──────────────────────────────────────────────
        // 2. My assigned tasks (top 5, not done)
        // ──────────────────────────────────────────────
        $myTasks = Task::with(['project', 'labels'])
            ->where('assignee_id', $userId)
            ->whereNull('deleted_at')
            ->whereNull('completed_at')
            ->orderByRaw("CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 0 ELSE 1 END", [$now->toDateString()])
            ->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderBy('due_date', 'asc')
            ->limit(5)
            ->get()
            ->map(function ($task) use ($user, $now) {
                return [
                    'id'               => $task->id,
                    'title'            => $task->title,
                    'type'             => $task->type ?? 'task',
                    'status'           => $task->status,
                    'priority'         => $task->priority,
                    'project_id'       => $task->project_id,
                    'project_name'     => $task->project?->name,
                    'project_color'    => $task->project?->color ?? '#6366f1',
                    'project_statuses' => $task->project?->statuses,
                    'due_date'         => $task->due_date?->toDateString(),
                    'is_overdue'       => $task->due_date && $task->due_date->lt($now),
                    'assignee_initials' => $this->getInitials($user->name),
                    'assignee_photo'   => $user->photo,
                ];
            });

        // ──────────────────────────────────────────────
        // 3. Recent activity feed (latest 8)
        // ──────────────────────────────────────────────
        $activityQuery = TaskActivity::with(['user', 'task.project'])
            ->orderBy('created_at', 'desc');

        if ($user->role !== 'admin') {
            $activityQuery->whereHas('task.project', function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            });
        }

        $activities = $activityQuery->limit(8)
            ->get()
            ->map(function ($activity) {
                return [
                    'id' => $activity->id,
                    'user_name' => $activity->user?->name ?? 'System',
                    'user_photo' => $activity->user?->photo,
                    'action' => $activity->action,
                    'details' => $activity->details,
                    'task_title' => $activity->task?->title,
                    'task_id' => $activity->task_id,
                    'project_name' => $activity->task?->project?->name,
                    'created_at' => $activity->created_at->toIso8601String(),
                ];
            });

        // ──────────────────────────────────────────────
        // 4. Project progress (all active projects)
        // ──────────────────────────────────────────────
        $projectQuery = Project::withCount([
                'tasks as total_tasks' => function ($q) {
                    $q->whereNull('deleted_at');
                },
                'tasks as done_tasks' => function ($q) {
                    $q->whereNotNull('completed_at')->whereNull('deleted_at');
                },
            ])
            ->whereNull('deleted_at')
            ->orderBy('name');

        if ($user->role !== 'admin') {
            $projectQuery->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('members', function ($sub) use ($user) {
                      $sub->where('user_id', $user->id);
                  });
            });
        }

        $projects = $projectQuery->get()
            ->map(function ($project) {
                $progress = $project->total_tasks > 0
                    ? round(($project->done_tasks / $project->total_tasks) * 100)
                    : 0;
                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'color' => $project->color ?? '#6366f1',
                    'progress' => $progress,
                    'total_tasks' => $project->total_tasks,
                    'done_tasks' => $project->done_tasks,
                ];
            });

        // ──────────────────────────────────────────────
        // 5. Upcoming deadlines (next 7 days, assigned to user)
        // ──────────────────────────────────────────────
        $upcomingDeadlines = Task::with(['project'])
            ->where('assignee_id', $userId)
            ->whereNotNull('due_date')
            ->where('due_date', '>=', $now->toDateString())
            ->where('due_date', '<=', $now->copy()->addDays(7)->toDateString())
            ->whereNull('completed_at')
            ->whereNull('deleted_at')
            ->orderBy('due_date', 'asc')
            ->limit(5)
            ->get()
            ->map(function ($task) use ($now) {
                $dueDate = $task->due_date;
                $isToday = $dueDate->isToday();
                $isTomorrow = $dueDate->isTomorrow();

                return [
                    'id' => $task->id,
                    'title' => $task->title,
                    'due_date' => $dueDate->toDateString(),
                    'is_today' => $isToday,
                    'is_tomorrow' => $isTomorrow,
                    'project_id' => $task->project_id,
                    'project_name' => $task->project?->name,
                    'project_color' => $task->project?->color ?? '#6366f1',
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total_projects' => $totalProjects,
                    'active_tasks' => $activeTasks,
                    'overdue_tasks' => $overdueTasks,
                    'completed_tasks' => $completedTasks,
                ],
                'my_tasks' => $myTasks,
                'activities' => $activities,
                'project_progress' => $projects,
                'upcoming_deadlines' => $upcomingDeadlines,
            ],
        ]);
    }

    private function getInitials(string $name): string
    {
        $parts = explode(' ', trim($name));
        if (count($parts) >= 2) {
            return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1));
        }
        return strtoupper(mb_substr($name, 0, 2));
    }
}
