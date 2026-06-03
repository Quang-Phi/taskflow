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
}
