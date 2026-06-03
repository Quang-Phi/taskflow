<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StatusTemplate extends Model
{
    protected $fillable = [
        'name',
        'statuses',
        'created_by',
    ];

    protected $casts = [
        'statuses' => 'array',
    ];

    protected $appends = [
        'workflow',
    ];

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
                'mode' => $wf->mode,
                'transitions' => $regularTransitions,
                'global_transitions' => $globalTransitions,
                'node_positions' => $nodePositions,
            ];
        }
        return [
            'mode' => 'unrestricted',
            'transitions' => [],
            'global_transitions' => [],
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
