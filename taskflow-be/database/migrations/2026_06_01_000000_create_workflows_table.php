<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create workflows table
        Schema::create('workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained('projects')->onDelete('cascade');
            $table->foreignId('status_template_id')->nullable()->constrained('status_templates')->onDelete('cascade');
            $table->string('mode')->default('unrestricted');
            $table->json('transitions')->nullable();
            $table->json('global_transitions')->nullable();
            $table->json('node_positions')->nullable();
            $table->timestamps();
        });

        // 2. Migrate existing workflows from projects
        $projects = DB::table('projects')->whereNotNull('workflow')->get();
        foreach ($projects as $project) {
            $wf = json_decode($project->workflow, true);
            if (is_array($wf)) {
                DB::table('workflows')->insert([
                    'project_id' => $project->id,
                    'mode' => $wf['mode'] ?? 'unrestricted',
                    'transitions' => isset($wf['transitions']) ? json_encode($wf['transitions']) : null,
                    'global_transitions' => isset($wf['global_transitions']) ? json_encode($wf['global_transitions']) : null,
                    'node_positions' => isset($wf['node_positions']) ? json_encode($wf['node_positions']) : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 3. Migrate existing workflows from status_templates
        $templates = DB::table('status_templates')->whereNotNull('workflow')->get();
        foreach ($templates as $template) {
            $wf = json_decode($template->workflow, true);
            if (is_array($wf)) {
                DB::table('workflows')->insert([
                    'status_template_id' => $template->id,
                    'mode' => $wf['mode'] ?? 'unrestricted',
                    'transitions' => isset($wf['transitions']) ? json_encode($wf['transitions']) : null,
                    'global_transitions' => isset($wf['global_transitions']) ? json_encode($wf['global_transitions']) : null,
                    'node_positions' => isset($wf['node_positions']) ? json_encode($wf['node_positions']) : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 4. Drop workflow columns from original tables
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('workflow');
        });

        Schema::table('status_templates', function (Blueprint $table) {
            $table->dropColumn('workflow');
        });
    }

    public function down(): void
    {
        // 1. Add workflow columns back
        Schema::table('projects', function (Blueprint $table) {
            $table->json('workflow')->nullable()->after('statuses');
        });

        Schema::table('status_templates', function (Blueprint $table) {
            $table->json('workflow')->nullable()->after('statuses');
        });

        // 2. Restore data from workflows table
        $projectWorkflows = DB::table('workflows')->whereNotNull('project_id')->get();
        foreach ($projectWorkflows as $pwf) {
            $workflow = [
                'mode' => $pwf->mode,
                'transitions' => $pwf->transitions ? json_decode($pwf->transitions, true) : [],
                'global_transitions' => $pwf->global_transitions ? json_decode($pwf->global_transitions, true) : [],
                'node_positions' => $pwf->node_positions ? json_decode($pwf->node_positions, true) : [],
            ];
            DB::table('projects')->where('id', $pwf->project_id)->update([
                'workflow' => json_encode($workflow),
            ]);
        }

        $templateWorkflows = DB::table('workflows')->whereNotNull('status_template_id')->get();
        foreach ($templateWorkflows as $twf) {
            $workflow = [
                'mode' => $twf->mode,
                'transitions' => $twf->transitions ? json_decode($twf->transitions, true) : [],
                'global_transitions' => $twf->global_transitions ? json_decode($twf->global_transitions, true) : [],
                'node_positions' => $twf->node_positions ? json_decode($twf->node_positions, true) : [],
            ];
            DB::table('status_templates')->where('id', $twf->status_template_id)->update([
                'workflow' => json_encode($workflow),
            ]);
        }

        // 3. Drop workflows table
        Schema::dropIfExists('workflows');
    }
};
