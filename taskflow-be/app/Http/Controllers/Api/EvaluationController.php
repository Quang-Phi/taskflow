<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Evaluation;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class EvaluationController extends Controller
{
    /**
     * GET /api/evaluations?period=Q2 2026
     * List all evaluations for a period, with employee info and task stats.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $period = $request->input('period');
        $status = $request->input('status');
        $employeeId = $request->input('employee_id');

        $query = Evaluation::with(['employee', 'evaluator']);

        if ($user->role === 'employee') {
            $query->where('employee_id', $user->id)
                  ->where('status', 'published');
        } elseif ($user->role === 'manager') {
            $subordinateIds = $this->getManagedEmployeeIds($user);
            $query->where(function($q) use ($user, $subordinateIds) {
                $q->whereIn('employee_id', $subordinateIds)
                  ->orWhere(function($subQ) use ($user) {
                      $subQ->where('employee_id', $user->id)
                           ->where('status', 'published');
                  });
            });
            if ($employeeId) {
                if (in_array((int)$employeeId, $subordinateIds, true) || (int)$employeeId === (int)$user->id) {
                    $query->where('employee_id', $employeeId);
                } else {
                    $query->where('id', 0);
                }
            }
            if ($status && $status !== 'all') {
                $query->where('status', $status);
            }
        } else {
            if ($employeeId) {
                $query->where('employee_id', $employeeId);
            }
            if ($status && $status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($period) {
            $query->where('period', $period);
        } elseif ($user->role !== 'employee' && !$employeeId) {
            $period = $this->getCurrentPeriod();
            $query->where('period', $period);
        }

        // Summary stats (unpaginated)
        $totalCount = $query->count();
        $publishedCount = (clone $query)->where('status', 'published')->count();
        $draftCount = (clone $query)->where('status', 'draft')->count();
        $avgScore = $totalCount > 0 ? round((clone $query)->avg('total_score'), 1) : 0;

        // Available periods (Distinct from DB + Suggested recent periods)
        $dbPeriods = Evaluation::selectRaw('DISTINCT period')
            ->pluck('period')
            ->toArray();

        $suggested = $this->getSuggestedPeriods();
        $merged = array_unique(array_merge($dbPeriods, $suggested));

        // Sort periods in descending order (newer year and quarter first)
        usort($merged, function ($a, $b) {
            preg_match('/Q(\d) (\d{4})/', $a, $matchesA);
            preg_match('/Q(\d) (\d{4})/', $b, $matchesB);
            
            $yearA = isset($matchesA[2]) ? (int)$matchesA[2] : 0;
            $qA = isset($matchesA[1]) ? (int)$matchesA[1] : 0;
            
            $yearB = isset($matchesB[2]) ? (int)$matchesB[2] : 0;
            $qB = isset($matchesB[1]) ? (int)$matchesB[1] : 0;
            
            if ($yearA !== $yearB) {
                return $yearB <=> $yearA;
            }
            return $qB <=> $qA;
        });

        $periods = $merged;

        if ($request->has('page')) {
            $perPage = $request->input('per_page', 10);
            $paginated = $query->orderBy('period', 'desc')->orderBy('total_score', 'desc')->paginate($perPage);
            
            $items = collect($paginated->items())->map(function ($eval) {
                if ($eval->status === 'draft') {
                    $eval->refreshStats();
                }
                return $this->formatEvaluation($eval);
            });

            return response()->json([
                'success' => true,
                'data' => $items,
                'summary' => [
                    'total_employees' => $totalCount,
                    'published' => $publishedCount,
                    'draft' => $draftCount,
                    'avg_score' => $avgScore,
                ],
                'periods' => $periods,
                'current_period' => $period,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'has_more' => $paginated->hasMorePages(),
                ]
            ]);
        }

        $evaluations = $query->orderBy('period', 'desc')->orderBy('total_score', 'desc')->get();

        $data = $evaluations->map(function ($eval) {
            if ($eval->status === 'draft') {
                $eval->refreshStats();
            }
            return $this->formatEvaluation($eval);
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'summary' => [
                'total_employees' => $totalCount,
                'published' => $publishedCount,
                'draft' => $draftCount,
                'avg_score' => $avgScore,
            ],
            'periods' => $periods,
            'current_period' => $period,
        ]);
    }

    /**
     * POST /api/evaluations/generate
     * Generate draft evaluations for all employees in a period.
     * Computes task stats automatically from the tasks table.
     */
    public function generate(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role === 'employee') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to generate evaluations',
            ], 403);
        }

        $request->validate([
            'period' => 'required|string|max:50',
        ]);

        $period = $request->input('period');
        $evaluatorId = $request->user()->id;

        if ($user->role === 'manager') {
            $subordinateIds = $this->getManagedEmployeeIds($user);
            $employeeIds = User::whereIn('id', $subordinateIds)
                ->where('active', true)
                ->pluck('id')
                ->toArray();
        } else {
            $employeeIds = User::where('active', true)
                ->pluck('id')
                ->toArray();
        }

        $created = 0;
        foreach ($employeeIds as $empId) {
            // Skip if evaluation already exists for this period/employee
            if (Evaluation::where('period', $period)->where('employee_id', $empId)->exists()) {
                continue;
            }

            $stats = $this->computeTaskStats($empId, $period);

            $eval = Evaluation::create([
                'period' => $period,
                'employee_id' => $empId,
                'evaluator_id' => $evaluatorId,
                'total_tasks' => $stats['total'],
                'completed_tasks' => $stats['completed'],
                'on_time_tasks' => $stats['on_time'],
                'on_time_rate' => $stats['on_time_rate'],
                'score_quality' => 0,
                'score_responsibility' => 0,
                'score_communication' => 0,
                'score_creativity' => 0,
                'score_discipline' => 0,
                'total_score' => 0,
                'status' => 'draft',
            ]);
            $eval->calculateTotalScore();
            $eval->save();

            $created++;
        }

        return response()->json([
            'success' => true,
            'message' => "Generated $created evaluations for period $period",
            'created' => $created,
        ]);
    }

    /**
     * GET /api/evaluations/{id}
     * Get a single evaluation with task details.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $eval = Evaluation::with(['employee', 'evaluator'])->find($id);
        if (!$eval) {
            return response()->json(['success' => false, 'message' => 'Evaluation not found'], 404);
        }

        if ($eval->status === 'draft') {
            $eval->refreshStats();
            $eval->refresh();
        }

        $user = $request->user();
        if ($user->role === 'employee') {
            if ($eval->employee_id !== $user->id || $eval->status !== 'published') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to view this evaluation',
                ], 403);
            }
        } elseif ($user->role === 'manager') {
            $subordinateIds = $this->getManagedEmployeeIds($user);
            $isOwnPublished = ($eval->employee_id === $user->id && $eval->status === 'published');
            $isSubordinate = in_array((int)$eval->employee_id, $subordinateIds, true);
            if (!$isOwnPublished && !$isSubordinate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to view this evaluation',
                ], 403);
            }
        }

        // Get the employee's tasks for the detail view
        $tasksQuery = Task::with(['project'])
            ->where('assignee_id', $eval->employee_id)
            ->whereNull('deleted_at');

        if ($eval->period) {
            $dates = $this->getPeriodDates($eval->period);
            if ($dates) {
                [$start, $end] = $dates;
                $tasksQuery->where(function ($q) use ($start, $end) {
                    $q->whereBetween('completed_at', [$start, $end])
                      ->orWhereBetween('due_date', [$start, $end]);
                });
            }
        }

        $lang = $request->header('X-Language', 'vi');

        $tasks = $tasksQuery->orderByRaw("CASE WHEN status = 'done' THEN 1 ELSE 0 END")
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(function ($task) use ($lang) {
                $isOnTime = true;
                $statusLabel = '';

                if ($task->status === 'done' && $task->due_date && $task->completed_at) {
                    $dueDate = Carbon::parse($task->due_date);
                    $completedAt = Carbon::parse($task->completed_at);
                    if ($completedAt->gt($dueDate)) {
                        $secondsLate = abs($completedAt->diffInSeconds($dueDate));
                        $daysLate = round($secondsLate / 86400, 1);
                        $isOnTime = false;
                        if ($lang === 'vi') {
                            $statusLabel = "❌ Trễ {$daysLate} ngày";
                        } elseif ($lang === 'ja') {
                            $statusLabel = "❌ {$daysLate}日遅れ";
                        } else {
                            $statusLabel = "❌ Late {$daysLate}d";
                        }
                    } else {
                        if ($lang === 'vi') {
                            $statusLabel = "✅ Đúng hạn";
                        } elseif ($lang === 'ja') {
                            $statusLabel = "✅ 予定通り";
                        } else {
                            $statusLabel = "✅ On time";
                        }
                    }
                } elseif ($task->status !== 'done') {
                    if ($lang === 'vi') {
                        $statusLabel = '⏳ Đang làm';
                    } elseif ($lang === 'ja') {
                        $statusLabel = '⏳ 進行中';
                    } else {
                        $statusLabel = '⏳ In progress';
                    }
                    if ($task->due_date && Carbon::parse($task->due_date)->lt(Carbon::now())) {
                        $isOnTime = false;
                        if ($lang === 'vi') {
                            $statusLabel = '⚠️ Quá hạn';
                        } elseif ($lang === 'ja') {
                            $statusLabel = '⚠️ 期限切れ';
                        } else {
                            $statusLabel = '⚠️ Overdue';
                        }
                    }
                }

                return [
                    'id' => $task->id,
                    'title' => $task->title,
                    'project_name' => $task->project?->name,
                    'due_date' => $task->due_date?->format('d/m'),
                    'completed_at' => $task->completed_at?->format('d/m'),
                    'status' => $task->status,
                    'status_label' => $statusLabel,
                    'is_on_time' => $isOnTime,
                ];
            });

        $formatted = $this->formatEvaluation($eval);
        $formatted['tasks'] = $tasks;

        return response()->json([
            'success' => true,
            'data' => $formatted,
        ]);
    }

    /**
     * PUT /api/evaluations/{id}
     * Update scores, comment, and optionally publish.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role === 'employee') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update evaluations',
            ], 403);
        }

        $eval = Evaluation::find($id);
        if (!$eval) {
            return response()->json(['success' => false, 'message' => 'Evaluation not found'], 404);
        }

        if ($user->role === 'manager') {
            $subordinateIds = $this->getManagedEmployeeIds($user);
            if (!in_array((int)$eval->employee_id, $subordinateIds, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to update this evaluation',
                ], 403);
            }
        }

        if ($eval->status === 'published') {
            return response()->json(['success' => false, 'message' => 'Cannot edit a published evaluation'], 403);
        }

        $request->validate([
            'comment' => 'nullable|string',
            'publish' => 'nullable|boolean',
        ]);

        if ($request->has('comment')) {
            $eval->comment = $request->input('comment');
        }

        // Refresh task stats
        $stats = $this->computeTaskStats($eval->employee_id, $eval->period);
        $eval->total_tasks = $stats['total'];
        $eval->completed_tasks = $stats['completed'];
        $eval->on_time_tasks = $stats['on_time'];
        $eval->on_time_rate = $stats['on_time_rate'];

        // Recalculate total
        $eval->calculateTotalScore();

        // Publish if requested
        if ($request->input('publish')) {
            $eval->status = 'published';
            $eval->published_at = Carbon::now();
        }

        $eval->save();

        return response()->json([
            'success' => true,
            'data' => $this->formatEvaluation($eval->load(['employee', 'evaluator'])),
        ]);
    }

    // ─── Helpers ─────────────────────────────────────

    private function getCurrentPeriod(): string
    {
        $month = Carbon::now()->month;
        $year = Carbon::now()->year;
        if ($month <= 3) return "Q1 $year";
        if ($month <= 6) return "Q2 $year";
        if ($month <= 9) return "Q3 $year";
        return "Q4 $year";
    }

    private function getPeriodDates(string $period): ?array
    {
        if (preg_match('/Q(\d) (\d{4})/', $period, $matches)) {
            $quarter = (int)$matches[1];
            $year = (int)$matches[2];
            
            $startMonth = ($quarter - 1) * 3 + 1;
            $endMonth = $quarter * 3;
            
            $start = Carbon::create($year, $startMonth, 1, 0, 0, 0)->startOfMonth();
            $end = Carbon::create($year, $endMonth, 1, 23, 59, 59)->endOfMonth();
            
            return [$start, $end];
        }
        return null;
    }

    private function computeTaskStats(int $userId, ?string $period = null): array
    {
        $totalQuery = Task::where('assignee_id', $userId)->whereNull('deleted_at');
        $completedQuery = Task::where('assignee_id', $userId)->where('status', 'done')->whereNull('deleted_at');
        
        $onTimeQuery = Task::where('assignee_id', $userId)
            ->where('status', 'done')
            ->whereNotNull('due_date')
            ->whereNotNull('completed_at')
            ->whereRaw('DATE(completed_at) <= due_date')
            ->whereNull('deleted_at');

        if ($period) {
            $dates = $this->getPeriodDates($period);
            if ($dates) {
                [$start, $end] = $dates;
                $filter = function ($q) use ($start, $end) {
                    $q->whereBetween('completed_at', [$start, $end])
                      ->orWhereBetween('due_date', [$start, $end]);
                };
                $totalQuery->where($filter);
                $completedQuery->where($filter);
                $onTimeQuery->where($filter);
            }
        }

        $totalTasks = $totalQuery->count();
        $completedTasks = $completedQuery->count();
        $onTimeTasks = $onTimeQuery->count();

        $onTimeRate = $completedTasks > 0 ? round(($onTimeTasks / $completedTasks) * 100, 1) : 0;

        return [
            'total' => $totalTasks,
            'completed' => $completedTasks,
            'on_time' => $onTimeTasks,
            'on_time_rate' => $onTimeRate,
        ];
    }

    private function formatEvaluation(Evaluation $eval): array
    {
        $employee = $eval->employee;
        $name = $employee?->name ?? 'Unknown';

        $parts = explode(' ', trim($name));
        $initials = count($parts) >= 2
            ? strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1))
            : strtoupper(mb_substr($name, 0, 2));

        $colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
        $charSum = array_sum(array_map('ord', str_split($name)));
        $color = $colors[$charSum % count($colors)];

        return [
            'id' => $eval->id,
            'period' => $eval->period,
            'employee_id' => $eval->employee_id,
            'employee_name' => $name,
            'employee_avatar' => $initials,
            'employee_color' => $color,
            'employee_department' => $employee?->work_position ?? '',
            'evaluator_name' => $eval->evaluator?->name,
            'total_tasks' => $eval->total_tasks,
            'completed_tasks' => $eval->completed_tasks,
            'on_time_tasks' => $eval->on_time_tasks,
            'on_time_rate' => $eval->on_time_rate,
            'total_score' => $eval->total_score,
            'comment' => $eval->comment,
            'status' => $eval->status,
            'published_at' => $eval->published_at?->toIso8601String(),
            'created_at' => $eval->created_at?->toIso8601String(),
        ];
    }

    private function getSuggestedPeriods(): array
    {
        $periods = [];
        $now = Carbon::now();
        for ($i = 0; $i < 6; $i++) {
            $month = $now->month;
            $year = $now->year;
            if ($month <= 3) {
                $q = "Q1 $year";
            } elseif ($month <= 6) {
                $q = "Q2 $year";
            } elseif ($month <= 9) {
                $q = "Q3 $year";
            } else {
                $q = "Q4 $year";
            }
            if (!in_array($q, $periods)) {
                $periods[] = $q;
            }
            $now->subMonths(3);
        }
        return $periods;
    }

    private function getManagedEmployeeIds(User $manager): array
    {
        // 1. Get all departments from Bitrix
        try {
            $bitrix = new \App\Services\BitrixService();
            $bitrix->ensureValidToken($manager);
            $departments = $bitrix->getDepartments();
        } catch (\Exception $e) {
            $departments = [];
        }

        // 2. Find departments headed by the manager
        $managedDeptIds = [];
        foreach ($departments as $dept) {
            $headId = $dept['UF_HEAD'] ?? null;
            if ($headId && (int)$headId === (int)$manager->id) {
                $managedDeptIds[] = (int)$dept['ID'];
            }
        }

        // 3. Recursively get sub-departments
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

        if (empty($managedDeptIds)) {
            return [];
        }

        // 4. Find all local users who belong to these departments using DB query
        $subordinateIds = User::where('id', '!=', $manager->id)
            ->where(function ($q) use ($managedDeptIds) {
                foreach ($managedDeptIds as $deptId) {
                    $q->orWhereJsonContains('department_ids', (int)$deptId)
                      ->orWhereJsonContains('department_ids', (string)$deptId);
                }
            })
            ->pluck('id')
            ->toArray();

        return array_map('intval', $subordinateIds);
    }

}
