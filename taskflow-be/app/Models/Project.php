<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name',
        'description',
        'color',
        'priority',
        'status',
        'statuses',
        'start_date',
        'end_date',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'statuses' => 'array',
    ];

    public function getStatusesAttribute($value)
    {
        if (empty($value)) {
            return [
                ["id" => "todo", "name" => "TO DO", "color" => "#9ca0b0", "type" => "not_started", "position" => 0],
                ["id" => "in_progress", "name" => "IN PROGRESS", "color" => "#3b82f6", "type" => "active", "position" => 1],
                ["id" => "review", "name" => "REVIEW", "color" => "#a855f7", "type" => "active", "position" => 2],
                ["id" => "done", "name" => "COMPLETE", "color" => "#22c55e", "type" => "closed", "position" => 3]
            ];
        }
        return is_string($value) ? json_decode($value, true) : $value;
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function labels(): HasMany
    {
        return $this->hasMany(Label::class);
    }

    public function customFields(): HasMany
    {
        return $this->hasMany(CustomField::class);
    }
}
