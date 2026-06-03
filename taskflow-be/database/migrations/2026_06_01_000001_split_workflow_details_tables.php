<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create workflow_transitions table
        Schema::create('workflow_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('workflows')->onDelete('cascade');
            $table->string('transition_key');
            $table->string('name')->nullable();
            $table->string('from')->nullable();
            $table->string('to');
            $table->json('allowed_roles')->nullable();
            $table->boolean('is_global')->default(false);
            $table->timestamps();
        });

        // 2. Create workflow_transition_rules table
        Schema::create('workflow_transition_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_transition_id')->constrained('workflow_transitions')->onDelete('cascade');
            $table->string('type');
            $table->json('config')->nullable();
            $table->timestamps();
        });

        // 3. Create workflow_node_positions table
        Schema::create('workflow_node_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('workflows')->onDelete('cascade');
            $table->string('status_id');
            $table->integer('x');
            $table->integer('y');
            $table->timestamps();
        });

        // 4. Migrate existing workflows JSON data into these new tables
        $workflows = DB::table('workflows')->get();
        foreach ($workflows as $wf) {
            // Transitions
            $transitions = json_decode($wf->transitions, true) ?: [];
            foreach ($transitions as $t) {
                $tId = DB::table('workflow_transitions')->insertGetId([
                    'workflow_id' => $wf->id,
                    'transition_key' => $t['id'],
                    'name' => $t['name'] ?? null,
                    'from' => $t['from'] ?? null,
                    'to' => $t['to'],
                    'allowed_roles' => isset($t['allowed_roles']) ? json_encode($t['allowed_roles']) : null,
                    'is_global' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($t['rules'] ?? [] as $rule) {
                    DB::table('workflow_transition_rules')->insert([
                        'workflow_transition_id' => $tId,
                        'type' => $rule['type'],
                        'config' => isset($rule['config']) ? json_encode($rule['config']) : null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            // Global transitions
            $globalTransitions = json_decode($wf->global_transitions, true) ?: [];
            foreach ($globalTransitions as $gt) {
                $gtId = DB::table('workflow_transitions')->insertGetId([
                    'workflow_id' => $wf->id,
                    'transition_key' => $gt['id'],
                    'name' => $gt['name'] ?? null,
                    'from' => null,
                    'to' => $gt['to'],
                    'allowed_roles' => isset($gt['allowed_roles']) ? json_encode($gt['allowed_roles']) : null,
                    'is_global' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach ($gt['rules'] ?? [] as $rule) {
                    DB::table('workflow_transition_rules')->insert([
                        'workflow_transition_id' => $gtId,
                        'type' => $rule['type'],
                        'config' => isset($rule['config']) ? json_encode($rule['config']) : null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            // Node positions
            $nodePositions = json_decode($wf->node_positions, true) ?: [];
            foreach ($nodePositions as $statusId => $coords) {
                DB::table('workflow_node_positions')->insert([
                    'workflow_id' => $wf->id,
                    'status_id' => $statusId,
                    'x' => $coords['x'] ?? 0,
                    'y' => $coords['y'] ?? 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 5. Drop the JSON columns from workflows table
        Schema::table('workflows', function (Blueprint $table) {
            $table->dropColumn(['transitions', 'global_transitions', 'node_positions']);
        });
    }

    public function down(): void
    {
        // 1. Re-add JSON columns to workflows table
        Schema::table('workflows', function (Blueprint $table) {
            $table->json('transitions')->nullable();
            $table->json('global_transitions')->nullable();
            $table->json('node_positions')->nullable();
        });

        // 2. Restore JSON data from new tables
        $workflows = DB::table('workflows')->get();
        foreach ($workflows as $wf) {
            $transitions = [];
            $globalTransitions = [];

            $dbTransitions = DB::table('workflow_transitions')
                ->where('workflow_id', $wf->id)
                ->get();

            foreach ($dbTransitions as $dt) {
                $rules = [];
                $dbRules = DB::table('workflow_transition_rules')
                    ->where('workflow_transition_id', $dt->id)
                    ->get();

                foreach ($dbRules as $dr) {
                    $rules[] = [
                        'type' => $dr->type,
                        'config' => json_decode($dr->config, true) ?: [],
                    ];
                }

                $tArray = [
                    'id' => $dt->transition_key,
                    'name' => $dt->name ?? '',
                    'to' => $dt->to,
                    'allowed_roles' => json_decode($dt->allowed_roles, true) ?: [],
                    'rules' => $rules,
                ];

                if ($dt->is_global) {
                    $globalTransitions[] = $tArray;
                } else {
                    $tArray['from'] = $dt->from;
                    $transitions[] = $tArray;
                }
            }

            $nodePositions = [];
            $dbPositions = DB::table('workflow_node_positions')
                ->where('workflow_id', $wf->id)
                ->get();

            foreach ($dbPositions as $dp) {
                $nodePositions[$dp->status_id] = [
                    'x' => $dp->x,
                    'y' => $dp->y,
                ];
            }

            DB::table('workflows')->where('id', $wf->id)->update([
                'transitions' => json_encode($transitions),
                'global_transitions' => json_encode($globalTransitions),
                'node_positions' => json_encode($nodePositions),
            ]);
        }

        // 3. Drop new tables
        Schema::dropIfExists('workflow_transition_rules');
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_node_positions');
    }
};
