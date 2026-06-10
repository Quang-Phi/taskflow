<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evaluation extends Model
{
    protected $fillable = [
        'period',
        'employee_id',
        'evaluator_id',
        'total_tasks',
        'completed_tasks',
        'on_time_tasks',
        'on_time_rate',
        'score_quality',
        'score_responsibility',
        'score_communication',
        'score_creativity',
        'score_discipline',
        'total_score',
        'comment',
        'status',
        'published_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'on_time_rate' => 'float',
        'total_score' => 'float',
        'score_quality' => 'float',
        'score_responsibility' => 'float',
        'score_communication' => 'float',
        'score_creativity' => 'float',
        'score_discipline' => 'float',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    /**
     * Calculate and set the total score from criteria scores and task stats.
     */
    public function calculateTotalScore(): float
    {
        // 50% from on-time rate, 50% from completion rate
        $taskScore = ($this->on_time_rate / 100) * 10 * 0.5;
        $completionRate = $this->total_tasks > 0
            ? ($this->completed_tasks / $this->total_tasks) * 10 * 0.5
            : 0;

        $this->total_score = round($taskScore + $completionRate, 1);
        return $this->total_score;
    }

    /**
     * Parse period string like "Q2 2026" into start and end Carbon instances.
     */
    public static function getPeriodDates(string $period): ?array
    {
        if (preg_match('/Q(\d) (\d{4})/', $period, $matches)) {
            $quarter = (int)$matches[1];
            $year = (int)$matches[2];
            
            $startMonth = ($quarter - 1) * 3 + 1;
            $endMonth = $quarter * 3;
            
            $start = \Carbon\Carbon::create($year, $startMonth, 1, 0, 0, 0)->startOfMonth();
            $end = \Carbon\Carbon::create($year, $endMonth, 1, 23, 59, 59)->endOfMonth();
            
            return [$start, $end];
        }
        return null;
    }

    /**
     * Compute task stats for a given employee and period.
     */
    public static function computeTaskStats(int $userId, ?string $period = null): array
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
            $dates = self::getPeriodDates($period);
            if ($dates) {
                [$start, $end] = $dates;
                $filter = function ($q) use ($start, $end) {
                    $q->where(function ($subQ) use ($start, $end) {
                        $subQ->whereBetween('completed_at', [$start, $end])
                             ->orWhereBetween('due_date', [$start, $end]);
                    });
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

    /**
     * Refresh task stats and recalculate total score for this evaluation.
     */
    public function refreshStats(): void
    {
        if ($this->status !== 'draft') {
            return;
        }

        $stats = self::computeTaskStats($this->employee_id, $this->period);
        $this->total_tasks = $stats['total'];
        $this->completed_tasks = $stats['completed'];
        $this->on_time_tasks = $stats['on_time'];
        $this->on_time_rate = $stats['on_time_rate'];
        $this->calculateTotalScore();
        $this->save();
    }

    /**
     * Refresh stats for all draft evaluations of a specific user.
     */
    public static function refreshUserEvaluations(int $userId): void
    {
        $evals = self::where('employee_id', $userId)
            ->where('status', 'draft')
            ->get();
            
        foreach ($evals as $eval) {
            $eval->refreshStats();
        }
    }
}
