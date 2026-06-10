<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskTemplate extends Model
{
    protected $fillable = [
        'project_id',
        'name',
        'description',
        'type',
        'priority',
        'estimated_hours',
        'checklist_template',
        'subtask_template',
        'custom_field_defaults',
        'created_by',
        'is_public',
        'source_task_id',
    ];

    protected $casts = [
        'checklist_template' => 'array',
        'subtask_template' => 'array',
        'custom_field_defaults' => 'array',
        'is_public' => 'boolean',
        'estimated_hours' => 'float',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sourceTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'source_task_id');
    }
}
