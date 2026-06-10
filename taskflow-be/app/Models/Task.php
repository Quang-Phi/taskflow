<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use SoftDeletes;

    protected static function booted()
    {
        static::addGlobalScope('activeProject', function ($builder) {
            $builder->whereHas('project');
        });

        static::created(function ($task) {
            \App\Models\TaskStatusHistory::create([
                'task_id' => $task->id,
                'from_status' => null,
                'to_status' => $task->status,
                'changed_by' => auth()->id() ?? $task->creator_id ?? 1,
                'changed_at' => $task->created_at ?: now(),
            ]);

            if ($task->assignee_id) {
                \App\Models\Evaluation::refreshUserEvaluations((int)$task->assignee_id);
            }
        });

        static::updating(function ($task) {
            if ($task->isDirty('status')) {
                $newStatus = $task->status;
                $project = $task->project;
                if ($project) {
                    $projectStatuses = $project->statuses;
                    $newIsClosed = false;
                    if (is_array($projectStatuses)) {
                        foreach ($projectStatuses as $s) {
                            if ($s['id'] === $newStatus && in_array($s['type'] ?? '', ['closed', 'done'])) {
                                $newIsClosed = true;
                                break;
                            }
                        }
                    }

                    if ($newIsClosed) {
                        $runningTimers = \App\Models\TimeEntry::where('task_id', $task->id)
                            ->whereNull('ended_at')
                            ->get();

                        foreach ($runningTimers as $entry) {
                            $entry->ended_at = now();
                            $entry->duration = abs($entry->ended_at->diffInSeconds($entry->started_at));
                            $entry->save();

                            $seconds = abs($entry->duration);
                            $h = floor($seconds / 3600);
                            $m = floor(($seconds % 3600) / 60);
                            $s = $seconds % 60;
                            $parts = [];
                            if ($h > 0) $parts[] = "{$h}h";
                            if ($m > 0) $parts[] = "{$m}m";
                            if ($s > 0 || empty($parts)) $parts[] = "{$s}s";
                            $durationStr = implode(' ', $parts);

                            \App\Models\TaskActivity::create([
                                'task_id' => $task->id,
                                'user_id' => $entry->user_id,
                                'action' => 'stopped_timer',
                                'details' => "Stopped timer. Logged {$durationStr}.",
                            ]);

                            event(new \App\Events\TimeTrackingUpdated((int)$task->project_id, (int)$entry->user_id, 'stopped', $entry->toArray()));
                        }
                    }
                }
            }
        });

        static::updated(function ($task) {
            if ($task->wasChanged('status')) {
                \App\Models\TaskStatusHistory::create([
                    'task_id' => $task->id,
                    'from_status' => $task->getOriginal('status'),
                    'to_status' => $task->status,
                    'changed_by' => auth()->id() ?? $task->creator_id ?? 1,
                    'changed_at' => now(),
                ]);
            }

            if ($task->wasChanged('assignee_id')) {
                $oldAssigneeId = $task->getOriginal('assignee_id');
                if ($oldAssigneeId) {
                    \App\Models\Evaluation::refreshUserEvaluations((int)$oldAssigneeId);
                }
            }

            if ($task->assignee_id && (
                $task->wasChanged('assignee_id') || 
                $task->wasChanged('status') || 
                $task->wasChanged('due_date') || 
                $task->wasChanged('completed_at')
            )) {
                \App\Models\Evaluation::refreshUserEvaluations((int)$task->assignee_id);
            }
        });

        static::deleted(function ($task) {
            if ($task->assignee_id) {
                \App\Models\Evaluation::refreshUserEvaluations((int)$task->assignee_id);
            }
        });
    }
    protected $fillable = [
        'project_id',
        'title',
        'description',
        'status',
        'priority',
        'type',
        'assignee_id',
        'creator_id',
        'estimated_hours',
        'actual_hours',
        'start_date',
        'due_date',
        'completed_at',
        'parent_task_id',
        'position',
        'watcher_ids',
        'is_recurring',
        'recurring_frequency',
        'recurring_interval',
        'recurring_weekdays',
        'recurring_monthday',
        'recurring_next_trigger',
        'recurring_time',
        'milestone_id',
    ];

    protected $casts = [
        'start_date' => 'datetime',
        'due_date' => 'datetime',
        'completed_at' => 'datetime',
        'watcher_ids' => 'array',
        'is_recurring' => 'boolean',
        'recurring_weekdays' => 'array',
        'recurring_next_trigger' => 'datetime',
        'recurring_interval' => 'integer',
        'recurring_monthday' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class, 'task_labels');
    }

    public function comments()
    {
        return $this->hasMany(TaskComment::class);
    }

    public function activities()
    {
        return $this->hasMany(TaskActivity::class);
    }

    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }

    public function subtasks()
    {
        return $this->hasMany(Task::class, 'parent_task_id');
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function customFieldValues()
    {
        return $this->hasMany(CustomFieldValue::class);
    }

    public function checklists()
    {
        return $this->hasMany(Checklist::class)->orderBy('position');
    }

    public function attachments()
    {
        return $this->hasMany(TaskAttachment::class);
    }

    public function taskAssignees(): HasMany
    {
        return $this->hasMany(TaskAssignee::class)->with('user');
    }

    public function reviewers(): HasMany
    {
        return $this->hasMany(TaskAssignee::class)->where('role', 'reviewer')->with('user');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(TaskApproval::class);
    }

    public function dependencies(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'task_id');
    }

    public function inverseDependencies(): HasMany
    {
        return $this->hasMany(TaskDependency::class, 'target_task_id');
    }

    public function template(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(TaskTemplate::class, 'source_task_id');
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class);
    }

    private function setTimeOnCarbon(\Carbon\Carbon $carbon): void
    {
        $timeStr = $this->recurring_time ?: '09:00';
        $parts = explode(':', $timeStr);
        $hour = isset($parts[0]) ? intval($parts[0]) : 9;
        $minute = isset($parts[1]) ? intval($parts[1]) : 0;
        $carbon->setTime($hour, $minute, 0);
    }

    public function calculateNextTriggerDate(?\Carbon\Carbon $from = null): ?\Carbon\Carbon
    {
        if (!$this->is_recurring || !$this->recurring_frequency) {
            return null;
        }

        $from = $from ? $from->copy() : now();
        $interval = $this->recurring_interval ?: 1;
        $next = null;

        switch ($this->recurring_frequency) {
            case 'daily':
                // Try today first
                $candidate = $from->copy();
                $this->setTimeOnCarbon($candidate);
                if ($candidate->gt($from)) {
                    $next = $candidate;
                } else {
                    $candidate = $from->copy()->addDays($interval);
                    $this->setTimeOnCarbon($candidate);
                    $next = $candidate;
                }
                break;

            case 'weekly':
                $weekdays = $this->recurring_weekdays;
                if (!is_array($weekdays)) {
                    $weekdays = json_decode($weekdays, true) ?: [];
                }
                $weekdays = array_map('intval', $weekdays);

                if (empty($weekdays)) {
                    $candidate = $from->copy()->addWeeks($interval);
                    $this->setTimeOnCarbon($candidate);
                    $next = $candidate;
                } else {
                    sort($weekdays);
                    $currentDayOfWeek = $from->dayOfWeekIso;

                    foreach ($weekdays as $day) {
                        if ($day >= $currentDayOfWeek) {
                            $daysToAdd = $day - $currentDayOfWeek;
                            $candidate = $from->copy()->addDays($daysToAdd);
                            $this->setTimeOnCarbon($candidate);
                            if ($candidate->gt($from)) {
                                $next = $candidate;
                                break;
                            }
                        }
                    }

                    if (!$next) {
                        $firstTargetDay = $weekdays[0];
                        $daysToAdd = (7 - $currentDayOfWeek) + $firstTargetDay + ($interval - 1) * 7;
                        $candidate = $from->copy()->addDays($daysToAdd);
                        $this->setTimeOnCarbon($candidate);
                        $next = $candidate;
                    }
                }
                break;

            case 'monthly':
                $monthday = $this->recurring_monthday ?: $from->day;

                // Try this month first
                $daysInMonth = $from->daysInMonth;
                $targetDay = min($monthday, $daysInMonth);
                $candidate = $from->copy()->day($targetDay);
                $this->setTimeOnCarbon($candidate);

                if ($candidate->gt($from)) {
                    $next = $candidate;
                } else {
                    $targetMonth = $from->copy()->addMonthsNoOverflow($interval);
                    $daysInTargetMonth = $targetMonth->daysInMonth;
                    $targetDay = min($monthday, $daysInTargetMonth);
                    $candidate = $targetMonth->day($targetDay);
                    $this->setTimeOnCarbon($candidate);
                    $next = $candidate;
                }
                break;

            case 'yearly':
                $candidate = $from->copy()->addYears($interval);
                $this->setTimeOnCarbon($candidate);
                $next = $candidate;
                break;
        }

        return $next;
    }

    public function processRecurrence(): ?Task
    {
        if (!$this->is_recurring || !$this->recurring_next_trigger) {
            return null;
        }

        $triggerDate = \Carbon\Carbon::parse($this->recurring_next_trigger);
        $suffix = '';
        switch ($this->recurring_frequency) {
            case 'daily':
                $suffix = ' - ' . $triggerDate->format('d/m/Y');
                break;
            case 'weekly':
                $suffix = ' - Tuần ' . $triggerDate->weekOfYear . '/' . $triggerDate->year;
                break;
            case 'monthly':
                $suffix = ' - Tháng ' . $triggerDate->format('m/Y');
                break;
            case 'yearly':
                $suffix = ' - Năm ' . $triggerDate->format('Y');
                break;
        }

        $project = $this->project;
        $projectStatuses = $project ? $project->statuses : [];
        $workflowInitialStatus = $project ? $project->workflow()->value('initial_status') : null;
        $firstStatusId = $projectStatuses[0]['id'] ?? 'todo';
        $status = $workflowInitialStatus ? $workflowInitialStatus : $firstStatusId;

        $maxPosition = Task::where('project_id', $this->project_id)
            ->where('status', $status)
            ->max('position') ?? 0;

        $clonedTask = Task::create([
            'project_id' => $this->project_id,
            'title' => $this->title . $suffix,
            'description' => $this->description,
            'status' => $status,
            'priority' => $this->priority ?? 'medium',
            'type' => $this->type ?? 'task',
            'assignee_id' => $this->assignee_id,
            'creator_id' => $this->creator_id,
            'estimated_hours' => $this->estimated_hours ?? 0,
            'actual_hours' => 0,
            'start_date' => $triggerDate,
            'due_date' => $this->due_date ? $triggerDate->copy()->addDays($this->start_date ? $this->start_date->diffInDays($this->due_date) : 0) : null,
            'completed_at' => null,
            'parent_task_id' => $this->parent_task_id,
            'position' => $maxPosition + 1,
            'is_recurring' => false,
        ]);

        if ($this->labels->isNotEmpty()) {
            $clonedTask->labels()->sync($this->labels->pluck('id'));
        }

        foreach ($this->customFieldValues as $val) {
            $clonedTask->customFieldValues()->create([
                'custom_field_id' => $val->custom_field_id,
                'value' => $val->value,
            ]);
        }

        foreach ($this->checklists as $list) {
            $newList = $clonedTask->checklists()->create([
                'name' => $list->name,
                'position' => $list->position,
            ]);
            foreach ($list->items as $item) {
                $newList->items()->create([
                    'name' => $item->name,
                    'is_checked' => $item->is_checked,
                    'assignee_id' => $item->assignee_id,
                    'position' => $item->position,
                ]);
            }
        }

        TaskDependency::create([
            'task_id' => $clonedTask->id,
            'target_task_id' => $this->id,
            'type' => 'clones',
            'created_by' => $this->creator_id ?? 1,
        ]);

        TaskActivity::create([
            'task_id' => $this->id,
            'user_id' => $this->creator_id ?? 1,
            'action' => 'linked_task',
            'details' => "Task này tự động sinh ra công việc định kỳ #{$clonedTask->id}",
        ]);

        TaskActivity::create([
            'task_id' => $clonedTask->id,
            'user_id' => $this->creator_id ?? 1,
            'action' => 'created',
            'details' => "Công việc định kỳ chu kỳ {$suffix} được tự động sinh ra.",
        ]);

        // Update trigger date of parent task
        $nextTrigger = $this->calculateNextTriggerDate($triggerDate);
        $this->recurring_next_trigger = $nextTrigger;
        $this->save();

        // Broadcast events
        $loadedTask = $clonedTask->load(['assignee', 'creator', 'labels', 'dependencies', 'inverseDependencies']);
        event(new \App\Events\TaskUpdated((int)$clonedTask->project_id, 'created', $loadedTask->toArray()));

        $loadedOriginalTask = $this->fresh(['dependencies', 'inverseDependencies']);
        event(new \App\Events\TaskUpdated((int)$this->project_id, 'updated', $loadedOriginalTask->toArray()));

        return $clonedTask;
    }
}

