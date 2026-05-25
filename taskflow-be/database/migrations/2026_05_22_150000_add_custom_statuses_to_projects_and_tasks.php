<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add statuses to projects
        Schema::table('projects', function (Blueprint $table) {
            $table->json('statuses')->nullable()->after('status');
        });

        // 2. Change tasks status enum to string
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('status', 255)->default('todo')->change();
        });

        // 3. Create status_templates table
        Schema::create('status_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->json('statuses');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 4. Pre-populate default system templates
        $defaultTemplates = [
            [
                'name' => 'Kanban',
                'statuses' => json_encode([
                    ['id' => 'todo', 'name' => 'TO DO', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
                    ['id' => 'in_progress', 'name' => 'IN PROGRESS', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
                    ['id' => 'complete', 'name' => 'COMPLETE', 'color' => '#22c55e', 'type' => 'closed', 'position' => 2]
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Scrum',
                'statuses' => json_encode([
                    ['id' => 'todo', 'name' => 'TO DO', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
                    ['id' => 'in_progress', 'name' => 'IN PROGRESS', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
                    ['id' => 'dev_done', 'name' => 'DEV DONE', 'color' => '#a855f7', 'type' => 'active', 'position' => 2],
                    ['id' => 'qa', 'name' => 'QA', 'color' => '#f59e0b', 'type' => 'active', 'position' => 3],
                    ['id' => 'done', 'name' => 'DONE', 'color' => '#22c55e', 'type' => 'closed', 'position' => 4]
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Marketing',
                'statuses' => json_encode([
                    ['id' => 'concept', 'name' => 'CONCEPT', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
                    ['id' => 'writing', 'name' => 'WRITING', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
                    ['id' => 'designing', 'name' => 'DESIGNING', 'color' => '#a855f7', 'type' => 'active', 'position' => 2],
                    ['id' => 'review', 'name' => 'REVIEW', 'color' => '#f59e0b', 'type' => 'active', 'position' => 3],
                    ['id' => 'published', 'name' => 'PUBLISHED', 'color' => '#22c55e', 'type' => 'closed', 'position' => 4]
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Content',
                'statuses' => json_encode([
                    ['id' => 'idea', 'name' => 'IDEA', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
                    ['id' => 'writing', 'name' => 'WRITING', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
                    ['id' => 'editing', 'name' => 'EDITING', 'color' => '#a855f7', 'type' => 'active', 'position' => 2],
                    ['id' => 'approval', 'name' => 'APPROVAL', 'color' => '#f59e0b', 'type' => 'active', 'position' => 3],
                    ['id' => 'published', 'name' => 'PUBLISHED', 'color' => '#22c55e', 'type' => 'closed', 'position' => 4]
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Normal',
                'statuses' => json_encode([
                    ['id' => 'todo', 'name' => 'TO DO', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
                    ['id' => 'in_progress', 'name' => 'IN PROGRESS', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
                    ['id' => 'closed', 'name' => 'CLOSED', 'color' => '#22c55e', 'type' => 'closed', 'position' => 2]
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];
        DB::table('status_templates')->insert($defaultTemplates);

        // 5. Seed existing projects and migrate tasks.status to match default values if needed
        $kanbanStatusesJson = json_encode([
            ['id' => 'todo', 'name' => 'TO DO', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
            ['id' => 'in_progress', 'name' => 'IN PROGRESS', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
            ['id' => 'review', 'name' => 'REVIEW', 'color' => '#a855f7', 'type' => 'active', 'position' => 2],
            ['id' => 'done', 'name' => 'COMPLETE', 'color' => '#22c55e', 'type' => 'closed', 'position' => 3]
        ]);

        DB::table('projects')->update(['statuses' => $kanbanStatusesJson]);

        // Clean up tasks whose status is review/done to review/done
        // Wait: tasks currently use 'todo', 'in_progress', 'review', 'done' as enum values
        // Our seeded project statuses mapped 'todo', 'in_progress', 'review' and 'done' as 'done' -> 'done' or 'complete'
        // Let's map 'done' to 'done' in project statuses so that existing tasks continue to map perfectly without data loss!
        $kanbanStatusesJsonWithDone = json_encode([
            ['id' => 'todo', 'name' => 'TO DO', 'color' => '#9ca0b0', 'type' => 'not_started', 'position' => 0],
            ['id' => 'in_progress', 'name' => 'IN PROGRESS', 'color' => '#3b82f6', 'type' => 'active', 'position' => 1],
            ['id' => 'review', 'name' => 'REVIEW', 'color' => '#a855f7', 'type' => 'active', 'position' => 2],
            ['id' => 'done', 'name' => 'COMPLETE', 'color' => '#22c55e', 'type' => 'closed', 'position' => 3]
        ]);
        DB::table('projects')->update(['statuses' => $kanbanStatusesJsonWithDone]);
    }

    public function down(): void
    {
        Schema::dropIfExists('status_templates');

        Schema::table('tasks', function (Blueprint $table) {
            $table->enum('status', ['todo', 'in_progress', 'review', 'done'])->default('todo')->change();
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('statuses');
        });
    }
};
