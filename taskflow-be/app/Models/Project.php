<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name',
        'description',
        'color',
        'icon',
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

    protected $appends = [
        'workflow',
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

    /**
     * Accessor for workflow attribute.
     * Returns a default unrestricted workflow with auto-generated transitions when null.
     */
    public function workflow(): HasOne
    {
        return $this->hasOne(Workflow::class);
    }

    public function getWorkflowAttribute()
    {
        $wf = $this->relationLoaded('workflow') ? $this->getRelation('workflow') : $this->workflow()->first();
        if ($wf) {
            $transitions = $wf->transitionsRelation()->with('rulesRelation')->get();
            $positions = $wf->nodePositionsRelation()->get();

            $regularTransitions = [];
            $globalTransitions = [];

            foreach ($transitions as $t) {
                $rules = [];
                foreach ($t->rulesRelation as $r) {
                    $rules[] = [
                        'type' => $r->type,
                        'config' => $r->config,
                    ];
                }

                $trArray = [
                    'id' => $t->transition_key,
                    'name' => $t->name ?? '',
                    'from' => $t->from,
                    'to' => $t->to,
                    'allowed_roles' => $t->allowed_roles ?? [],
                    'rules' => $rules,
                ];

                if ($t->is_global) {
                    unset($trArray['from']);
                    $globalTransitions[] = $trArray;
                } else {
                    $regularTransitions[] = $trArray;
                }
            }

            $nodePositions = [];
            foreach ($positions as $pos) {
                $nodePositions[$pos->status_id] = [
                    'x' => (int)$pos->x,
                    'y' => (int)$pos->y,
                ];
            }

            return [
                'mode'               => $wf->mode,
                'initial_status'     => $wf->initial_status,
                'transitions'        => $regularTransitions,
                'global_transitions' => $globalTransitions,
                'node_positions'     => $nodePositions,
            ];
        }

        // Auto-generate default workflow from project statuses
        $statuses = $this->statuses;
        if (empty($statuses) || !is_array($statuses)) {
            return [
                'mode' => 'unrestricted',
                'transitions' => [],
                'global_transitions' => [],
            ];
        }

        usort($statuses, fn($a, $b) => ($a['position'] ?? 0) - ($b['position'] ?? 0));

        $transitions = [];
        $counter = 1;

        // Forward transitions
        for ($i = 0; $i < count($statuses) - 1; $i++) {
            $fromId = $statuses[$i]['id'];
            $toId = $statuses[$i + 1]['id'];
            $fromName = $statuses[$i]['name'] ?? $fromId;
            $toName = $statuses[$i + 1]['name'] ?? $toId;

            $transitions[] = [
                'id' => 't' . $counter++,
                'name' => $fromName . ' → ' . $toName,
                'from' => $fromId,
                'to' => $toId,
                'allowed_roles' => [],
            ];
        }

        // Reverse transitions
        for ($i = count($statuses) - 1; $i > 0; $i--) {
            $fromId = $statuses[$i]['id'];
            $toId = $statuses[$i - 1]['id'];
            $fromName = $statuses[$i]['name'] ?? $fromId;
            $toName = $statuses[$i - 1]['name'] ?? $toId;

            $transitions[] = [
                'id' => 't' . $counter++,
                'name' => $fromName . ' → ' . $toName,
                'from' => $fromId,
                'to' => $toId,
                'allowed_roles' => [],
            ];
        }

        return [
            'mode' => 'unrestricted',
            'transitions' => $transitions,
            'global_transitions' => [],
        ];
    }

    /**
     * Get available transitions from a given status for a user with the specified role.
     *
     * @param string $fromStatus The current status ID
     * @param string $userRole The user's project role ('manager', 'member')
     * @param bool $isAdmin Whether the user is a system admin (bypasses all restrictions)
     * @return array List of available transitions
     */
    public function getAvailableTransitions(string $fromStatus, string $userRole, bool $isAdmin = false, $userId = null): array
    {
        $workflow = $this->workflow;
        $mode = $workflow['mode'] ?? 'unrestricted';
        $transitions = $workflow['transitions'] ?? [];
        $globalTransitions = $workflow['global_transitions'] ?? [];

        if ($mode === 'unrestricted' || (empty($transitions) && empty($globalTransitions))) {
            // In unrestricted mode, return all statuses except the current one as valid targets
            $statuses = $this->statuses;
            $available = [];
            foreach ($statuses as $status) {
                if ($status['id'] !== $fromStatus) {
                    $available[] = [
                        'id' => 'auto_' . $status['id'],
                        'name' => $status['name'] ?? $status['id'],
                        'from' => $fromStatus,
                        'to' => $status['id'],
                        'allowed_roles' => [],
                    ];
                }
            }
            return $available;
        }

        // Restricted mode: only valid defined transitions
        $available = [];
        $transitions = $workflow['transitions'] ?? [];
        $globalTransitions = $workflow['global_transitions'] ?? [];

        // Check regular transitions from this status
        foreach ($transitions as $transition) {
            if ($transition['from'] !== $fromStatus) {
                continue;
            }

            $allowedRoles = $transition['allowed_roles'] ?? [];

            // Admin bypasses all role restrictions
            if ($isAdmin || empty($allowedRoles) || in_array($userRole, $allowedRoles)) {
                // ALSO check restrict_role rules if userId is provided
                $rules = $transition['rules'] ?? [];
                $allowedByRules = true;
                if ($userId && !empty($rules)) {
                    foreach ($rules as $rule) {
                        if (($rule['type'] ?? '') === 'restrict_role') {
                            $type = $rule['config']['type'] ?? 'manager';
                            $userIds = $rule['config']['userIds'] ?? [];
                            if ($isAdmin || (int)$this->created_by === (int)$userId) {
                                // bypass for admin and creator
                            } elseif ($type === 'manager') {
                                if ($userRole !== 'manager') {
                                    $allowedByRules = false;
                                }
                            } elseif ($type === 'flexible') {
                                if (!in_array((int)$userId, array_map('intval', $userIds))) {
                                    $allowedByRules = false;
                                }
                            }
                        }
                    }
                }
                if ($allowedByRules) {
                    $available[] = $transition;
                }
            }
        }

        // Check global transitions (can be performed from any status)
        foreach ($globalTransitions as $globalTransition) {
            // Skip if the target is the same as current status
            if (($globalTransition['to'] ?? '') === $fromStatus) {
                continue;
            }

            $allowedRoles = $globalTransition['allowed_roles'] ?? [];

            if ($isAdmin || empty($allowedRoles) || in_array($userRole, $allowedRoles)) {
                // ALSO check restrict_role rules if userId is provided
                $rules = $globalTransition['rules'] ?? [];
                $allowedByRules = true;
                if ($userId && !empty($rules)) {
                    foreach ($rules as $rule) {
                        if (($rule['type'] ?? '') === 'restrict_role') {
                            $type = $rule['config']['type'] ?? 'manager';
                            $userIds = $rule['config']['userIds'] ?? [];
                            if ($isAdmin || (int)$this->created_by === (int)$userId) {
                                // bypass for admin and creator
                            } elseif ($type === 'manager') {
                                if ($userRole !== 'manager') {
                                    $allowedByRules = false;
                                }
                            } elseif ($type === 'flexible') {
                                if (!in_array((int)$userId, array_map('intval', $userIds))) {
                                    $allowedByRules = false;
                                }
                            }
                        }
                    }
                }
                if ($allowedByRules) {
                    $available[] = array_merge($globalTransition, ['from' => $fromStatus]);
                }
            }
        }

        return $available;
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')
            ->withPivot('role', 'joined_at')
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
