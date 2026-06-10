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
        $currentUser = $request->user();
        if (!$currentUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $projectId = $request->input('project_id'); // 'all' or specific id
        $now = Carbon::now();

        // Get allowed project IDs for non-admin users
        $allowedProjectIds = [];
        if ($currentUser->role !== 'admin') {
            $allowedProjectIds = Project::whereNull('deleted_at')
                ->where(function ($q) use ($currentUser) {
                    $q->where('created_by', $currentUser->id)
                      ->orWhereHas('members', function ($sub) use ($currentUser) {
                          $sub->where('user_id', $currentUser->id);
                      });
                })
                ->pluck('id')
                ->toArray();
        }

        // Base query builder (scoped to project if specified)
        $taskQuery = Task::whereNull('deleted_at');
        if ($currentUser->role !== 'admin') {
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
            if ($task->due_date !== null && Carbon::parse($task->due_date)->lt($now)) {
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
        // 5.5. Process Performance (I13 - Cycle Time, Lead Time, Throughput, WIP)
        // ──────────────────────────────────────────────
        $completedTasks = (clone $taskQuery)->whereNotNull('completed_at')->get();
        $completedTaskIds = $completedTasks->pluck('id')->toArray();

        // Fetch status history for completed tasks
        $histories = DB::table('task_status_history')
            ->whereIn('task_id', $completedTaskIds)
            ->orderBy('changed_at', 'asc')
            ->get()
            ->groupBy('task_id');

        $totalCycleHours = 0;
        $cycleTasksCount = 0;

        $totalLeadHours = 0;
        $leadTasksCount = 0;

        foreach ($completedTasks as $task) {
            $created = Carbon::parse($task->created_at);
            $completed = Carbon::parse($task->completed_at);
            
            // Lead Time
            $leadHours = abs($completed->diffInHours($created));
            $totalLeadHours += $leadHours;
            $leadTasksCount++;

            // Cycle Time
            $taskHistories = $histories->get($task->id) ?: collect();
            $firstActiveTime = null;
            $firstClosedTime = null;

            // Map project statuses
            $proj = $projectsList->get($task->project_id);
            $statuses = $proj ? $proj->statuses : [];
            $statusTypes = [];
            foreach ($statuses as $s) {
                $statusTypes[$s['id']] = $s['type'] ?? 'not_started';
            }

            foreach ($taskHistories as $h) {
                $type = $statusTypes[$h->to_status] ?? 'not_started';
                if ($type === 'active' && is_null($firstActiveTime)) {
                    $firstActiveTime = Carbon::parse($h->changed_at);
                }
                if ($type === 'closed' && is_null($firstClosedTime)) {
                    $firstClosedTime = Carbon::parse($h->changed_at);
                }
            }

            if ($firstActiveTime && $firstClosedTime) {
                $cycleHours = abs($firstClosedTime->diffInHours($firstActiveTime));
                $totalCycleHours += $cycleHours;
                $cycleTasksCount++;
            } else {
                // Fallback to Lead Time
                $totalCycleHours += $leadHours;
                $cycleTasksCount++;
            }
        }

        $avgCycleTimeDays = $cycleTasksCount > 0 ? round(($totalCycleHours / $cycleTasksCount) / 24, 1) : 0;
        $avgLeadTimeDays = $leadTasksCount > 0 ? round(($totalLeadHours / $leadTasksCount) / 24, 1) : 0;

        // WIP calculation (Tasks in active type statuses)
        $wipCount = 0;
        $activeTasks = (clone $taskQuery)->whereNull('completed_at')->get();
        foreach ($activeTasks as $task) {
            $proj = $projectsList->get($task->project_id);
            $statuses = $proj ? $proj->statuses : [];
            $statusType = 'not_started';
            foreach ($statuses as $s) {
                if ($s['id'] === $task->status) {
                    $statusType = $s['type'] ?? 'not_started';
                    break;
                }
            }
            if ($statusType === 'active' || $task->status === 'review') {
                $wipCount++;
            }
        }

        // Weekly throughput trend (last 8 weeks)
        $throughputTrend = [];
        $totalThroughputCompleted = 0;
        for ($i = 7; $i >= 0; $i--) {
            $weekStart = $now->copy()->subWeeks($i)->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();

            $completedCount = (clone $taskQuery)
                ->whereNotNull('completed_at')
                ->whereBetween('completed_at', [$weekStart, $weekEnd])
                ->count();

            $weekLabel = 'W' . (8 - $i);
            $throughputTrend[] = [
                'week' => $weekLabel,
                'throughput' => $completedCount,
            ];
            $totalThroughputCompleted += $completedCount;
        }
        $avgThroughputWeekly = round($totalThroughputCompleted / 8, 1);

        // Cycle time trend (last 8 weeks)
        $cycleTimeTrend = [];
        for ($i = 7; $i >= 0; $i--) {
            $weekStart = $now->copy()->subWeeks($i)->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();

            $weekTasks = (clone $taskQuery)
                ->whereNotNull('completed_at')
                ->whereBetween('completed_at', [$weekStart, $weekEnd])
                ->get();

            $weekTaskIds = $weekTasks->pluck('id')->toArray();
            $weekHistories = DB::table('task_status_history')
                ->whereIn('task_id', $weekTaskIds)
                ->orderBy('changed_at', 'asc')
                ->get()
                ->groupBy('task_id');

            $weekTotalCycleHours = 0;
            $weekCycleCount = 0;

            foreach ($weekTasks as $task) {
                $created = Carbon::parse($task->created_at);
                $completed = Carbon::parse($task->completed_at);
                $leadHours = abs($completed->diffInHours($created));

                $taskHistories = $weekHistories->get($task->id) ?: collect();
                $firstActiveTime = null;
                $firstClosedTime = null;

                $proj = $projectsList->get($task->project_id);
                $statuses = $proj ? $proj->statuses : [];
                $statusTypes = [];
                foreach ($statuses as $s) {
                    $statusTypes[$s['id']] = $s['type'] ?? 'not_started';
                }

                foreach ($taskHistories as $h) {
                    $type = $statusTypes[$h->to_status] ?? 'not_started';
                    if ($type === 'active' && is_null($firstActiveTime)) {
                        $firstActiveTime = Carbon::parse($h->changed_at);
                    }
                    if ($type === 'closed' && is_null($firstClosedTime)) {
                        $firstClosedTime = Carbon::parse($h->changed_at);
                    }
                }

                if ($firstActiveTime && $firstClosedTime) {
                    $weekTotalCycleHours += abs($firstClosedTime->diffInHours($firstActiveTime));
                    $weekCycleCount++;
                } else {
                    $weekTotalCycleHours += $leadHours;
                    $weekCycleCount++;
                }
            }

            $weekAvgDays = $weekCycleCount > 0 ? round(($weekTotalCycleHours / $weekCycleCount) / 24, 1) : 0;
            $weekLabel = 'W' . (8 - $i);

            $cycleTimeTrend[] = [
                'week' => $weekLabel,
                'avg_days' => $weekAvgDays,
            ];
        }

        $processPerformance = [
            'cycle_time_avg' => $avgCycleTimeDays,
            'lead_time_avg' => $avgLeadTimeDays,
            'throughput_weekly_avg' => $avgThroughputWeekly,
            'wip_count' => $wipCount,
            'throughput_trend' => $throughputTrend,
            'cycle_time_trend' => $cycleTimeTrend,
        ];

        // ──────────────────────────────────────────────
        // 6. Projects list for filter dropdown
        // ──────────────────────────────────────────────
        $projectsQuery = Project::whereNull('deleted_at');
        if ($currentUser->role !== 'admin') {
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
                'process_performance' => $processPerformance,
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
