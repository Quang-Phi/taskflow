<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowTransition extends Model
{
    protected $fillable = [
        'workflow_id',
        'transition_key',
        'name',
        'from',
        'to',
        'allowed_roles',
        'is_global',
    ];

    protected $casts = [
        'allowed_roles' => 'array',
        'is_global' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function rulesRelation(): HasMany
    {
        return $this->hasMany(WorkflowTransitionRule::class, 'workflow_transition_id');
    }
}
