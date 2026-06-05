<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workflow extends Model
{
    protected $fillable = [
        'project_id',
        'status_template_id',
        'mode',
        'initial_status',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function statusTemplate(): BelongsTo
    {
        return $this->belongsTo(StatusTemplate::class);
    }

    public function transitionsRelation(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class);
    }

    public function nodePositionsRelation(): HasMany
    {
        return $this->hasMany(WorkflowNodePosition::class);
    }
}
