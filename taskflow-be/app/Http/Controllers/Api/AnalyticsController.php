<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * GET /api/analytics/data
     * Returns all analytics charts data in a single request.
     */
    public function data(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $projectId = $request->input('project_id'); // 'all' or specific id
        $now = Carbon::now();

        // Get allowed project IDs for non-admin users
        $allowedProjectIds = [];
        if ($user->role !== 'admin') {
            $allowedProjectIds = Project::whereNull('deleted_at')
                ->where(function ($q) use ($user) {
                    $q->where('created_by', $user->id)
                      ->orWhereHas('members', function ($sub) use ($user) {
                          $sub->where('user_id', $user->id);
                      });
                })
                ->pluck('id')
                ->toArray();
        }

        // Base query builder (scoped to project if specified)
        $taskQuery = Task::whereNull('deleted_at');
        if ($user->role !== 'admin') {
            if ($projectId && $projectId !== 'all') {
                if (!in_array((int)$projectId, $allowedProjectIds)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unauthorized to view this project\'s analytics data',
                    ], 403);
                }
                $taskQuery->where('project_id', $projectId);
            } else {
                $taskQuery->whereIn('project_id', $allowedProjectIds);
            }
        } else {
            if ($projectId && $projectId !== 'all') {
                $taskQuery->where('project_id', $projectId);
            }
        }

        // 1. Task overview (donut chart) — by status
        // ──────────────────────────────────────────────
        $tasks = (clone $taskQuery)->get();
        // Load all projects referenced to get their statuses mapping
        $projectIds = $tasks->pluck('project_id')->unique();
        $projectsList = Project::whereIn('id', $projectIds)->get()->keyBy('id');

        $doneCount = 0;
        $inProgressCount = 0;
        $reviewCount = 0;
        $todoCount = 0;
        $overdueCount = 0;

        foreach ($tasks as $task) {
            if ($task->completed_at !== null) {
                $doneCount++;
                continue;
            }
            if ($task->due_date !== null && Carbon::parse($task->due_date)->lt($now->copy()->startOfDay())) {
                $overdueCount++;
                continue;
            }
            
            // Map other statuses using project configuration
            $proj = $projectsList->get($task->project_id);
            $statuses = $proj ? $proj->statuses : [];
            
            $statusType = 'not_started';
            $statusId = $task->status;
            foreach ($statuses as $s) {
                if ($s['id'] === $statusId) {
                    $statusType = $s['type'] ?? 'not_started';
                    break;
                }
            }

            if ($statusId === 'review') {
                $reviewCount++;
            } elseif ($statusType === 'active') {
                $inProgressCount++;
            } else {
                $todoCount++;
            }
        }

        $taskOverview = [
            ['name' => 'done', 'value' => $doneCount, 'color' => '#22c55e'],
            ['name' => 'in_progress', 'value' => $inProgressCount, 'color' => '#3b82f6'],
            ['name' => 'review', 'value' => $reviewCount, 'color' => '#a855f7'],
            ['name' => 'todo', 'value' => $todoCount, 'color' => '#9ca0b0'],
            ['name' => 'overdue', 'value' => $overdueCount, 'color' => '#ef4444'],
        ];

        $totalTasks = array_sum(array_column($taskOverview, 'value'));

        // ──────────────────────────────────────────────
        // 2. Priority distribution (bar chart)
        // ──────────────────────────────────────────────
        $priorityCounts = (clone $taskQuery)
            ->selectRaw('priority, COUNT(*) as count')
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        $priorityDist = [
            ['name' => 'urgent', 'count' => $priorityCounts['urgent'] ?? 0, 'color' => '#ef4444'],
            ['name' => 'high', 'count' => $priorityCounts['high'] ?? 0, 'color' => '#f97316'],
            ['name' => 'medium', 'count' => $priorityCounts['medium'] ?? 0, 'color' => '#f59e0b'],
            ['name' => 'low', 'count' => $priorityCounts['low'] ?? 0, 'color' => '#3b82f6'],
            ['name' => 'none', 'count' => $priorityCounts['none'] ?? 0, 'color' => '#9ca0b0'],
        ];

        // ──────────────────────────────────────────────
        // 3. Completion trend (line chart) — last 8 weeks
        // ──────────────────────────────────────────────
        $completionTrend = [];
        for ($i = 7; $i >= 0; $i--) {
            $weekStart = $now->copy()->subWeeks($i)->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();

            $completed = (clone $taskQuery)
                ->whereNotNull('completed_at')
                ->whereBetween('completed_at', [$weekStart, $weekEnd])
                ->count();

            $created = (clone $taskQuery)
                ->whereBetween('created_at', [$weekStart, $weekEnd])
                ->count();

            $weekLabel = 'W' . (8 - $i);

            $completionTrend[] = [
                'week' => $weekLabel,
                'completed' => $completed,
                'created' => $created,
            ];
        }

        // ──────────────────────────────────────────────
        // 4. Team workload (horizontal bar)
        // ──────────────────────────────────────────────
        $workloadData = (clone $taskQuery)
            ->whereNotNull('assignee_id')
            ->whereNull('completed_at')
            ->selectRaw('assignee_id, COUNT(*) as task_count')
            ->groupBy('assignee_id')
            ->orderByDesc('task_count')
            ->limit(10)
            ->get();

        $userIds = $workloadData->pluck('assignee_id')->toArray();
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        $colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4'];
        $workload = $workloadData->values()->map(function ($item, $idx) use ($users, $colors) {
            $user = $users->get($item->assignee_id);
            return [
                'name' => $user ? $user->name : 'Unknown',
                'tasks' => $item->task_count,
                'color' => $colors[$idx % count($colors)],
            ];
        });

        // ──────────────────────────────────────────────
        // 5. Team performance table
        // ──────────────────────────────────────────────
        $allAssignees = (clone $taskQuery)
            ->whereNotNull('assignee_id')
            ->selectRaw('assignee_id')
            ->groupBy('assignee_id')
            ->pluck('assignee_id')
            ->toArray();

        $allUsers = User::whereIn('id', $allAssignees)->get()->keyBy('id');

        $teamPerformance = [];
        foreach ($allAssignees as $idx => $assigneeId) {
            $user = $allUsers->get($assigneeId);
            if (!$user) continue;

            $userTasksQuery = (clone $taskQuery)->where('assignee_id', $assigneeId);
            $totalUserTasks = (clone $userTasksQuery)->count();
            $completedUserTasks = (clone $userTasksQuery)->whereNotNull('completed_at')->count();

            // On-time: completed tasks where completed_at <= due_date
            $onTimeCount = 0;
            if ($completedUserTasks > 0) {
                $onTimeCount = (clone $taskQuery)
                    ->where('assignee_id', $assigneeId)
                    ->whereNotNull('due_date')
                    ->whereNotNull('completed_at')
                    ->whereRaw('DATE(completed_at) <= due_date')
                    ->count();
            }
            $onTimePct = $completedUserTasks > 0 ? round(($onTimeCount / $completedUserTasks) * 100) : 0;

            // Avg completion time (days between created_at and completed_at)
            $avgDays = (clone $taskQuery)
                ->where('assignee_id', $assigneeId)
                ->whereNotNull('completed_at')
                ->selectRaw("AVG(DATEDIFF(completed_at, created_at)) as avg_days")
                ->value('avg_days');

            $initials = $this->getInitials($user->name);

            $teamPerformance[] = [
                'name' => $user->name,
                'avatar' => $initials,
                'color' => $colors[$idx % count($colors)],
                'total' => $totalUserTasks,
                'completed' => $completedUserTasks,
                'on_time' => $onTimePct,
                'avg_time' => $avgDays !== null ? round($avgDays, 1) . 'd' : '0d',
            ];
        }

        // Sort by total tasks desc
        usort($teamPerformance, fn($a, $b) => $b['total'] - $a['total']);

        // ──────────────────────────────────────────────
        // 6. Projects list for filter dropdown
        // ──────────────────────────────────────────────
        $projectsQuery = Project::whereNull('deleted_at');
        if ($user->role !== 'admin') {
            $projectsQuery->whereIn('id', $allowedProjectIds);
        }
        $projects = $projectsQuery->orderBy('name')->get(['id', 'name', 'color']);

        return response()->json([
            'success' => true,
            'data' => [
                'task_overview' => $taskOverview,
                'total_tasks' => $totalTasks,
                'priority_dist' => $priorityDist,
                'completion_trend' => $completionTrend,
                'workload' => $workload,
                'team_performance' => $teamPerformance,
                'projects' => $projects,
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
