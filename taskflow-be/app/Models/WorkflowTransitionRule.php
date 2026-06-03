<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowTransitionRule extends Model
{
    protected $fillable = [
        'workflow_transition_id',
        'type',
        'config',
    ];

    protected $casts = [
        'config' => 'array',
    ];

    public function transition(): BelongsTo
    {
        return $this->belongsTo(WorkflowTransition::class, 'workflow_transition_id');
    }
}
