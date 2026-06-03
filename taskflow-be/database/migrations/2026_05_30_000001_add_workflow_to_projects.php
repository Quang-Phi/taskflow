<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add workflow JSON column to projects table
        Schema::table('projects', function (Blueprint $table) {
            $table->json('workflow')->nullable()->after('statuses');
        });

        // 2. Generate default workflow transitions for each existing project
        $projects = DB::table('projects')->whereNotNull('statuses')->get();

        foreach ($projects as $project) {
            $statuses = json_decode($project->statuses, true);

            if (empty($statuses) || !is_array($statuses)) {
                continue;
            }

            // Sort statuses by position
            usort($statuses, fn($a, $b) => ($a['position'] ?? 0) - ($b['position'] ?? 0));

            $transitions = [];
            $counter = 1;

            // Generate linear forward transitions (status[0] → status[1] → status[2] → ...)
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

            // Generate reverse transitions (status[1] → status[0], status[2] → status[1], ...)
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

            $workflow = [
                'mode' => 'unrestricted',
                'transitions' => $transitions,
                'global_transitions' => [],
            ];

            DB::table('projects')
                ->where('id', $project->id)
                ->update(['workflow' => json_encode($workflow)]);
        }
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('workflow');
        });
    }
};
