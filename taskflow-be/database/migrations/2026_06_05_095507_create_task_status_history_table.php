<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('task_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->constrained('users')->onDelete('cascade');
            $table->timestamp('changed_at');
        });

        // Populate status history for existing tasks
        $tasks = DB::table('tasks')->get();
        foreach ($tasks as $task) {
            // Initial status when created
            DB::table('task_status_history')->insert([
                'task_id' => $task->id,
                'from_status' => null,
                'to_status' => $task->status,
                'changed_by' => $task->creator_id ?: 1,
                'changed_at' => $task->created_at ?: now(),
            ]);

            // If task is completed, log the closed state change at completed_at
            if ($task->completed_at) {
                // Determine project statuses to find closed type status
                $project = DB::table('projects')->where('id', $task->project_id)->first();
                $statuses = $project ? json_decode($project->statuses ?? '[]', true) : [];
                
                $activeStatus = 'in_progress';
                if (is_array($statuses)) {
                    foreach ($statuses as $s) {
                        if (($s['type'] ?? '') === 'active') {
                            $activeStatus = $s['id'];
                            break;
                        }
                    }
                }

                $created = \Carbon\Carbon::parse($task->created_at);
                $completed = \Carbon\Carbon::parse($task->completed_at);
                $diffHours = $completed->diffInHours($created);

                if ($diffHours > 1) {
                    $startedAt = $created->copy()->addHours($diffHours / 2);
                    DB::table('task_status_history')->insert([
                        'task_id' => $task->id,
                        'from_status' => null,
                        'to_status' => $activeStatus,
                        'changed_by' => $task->assignee_id ?: $task->creator_id ?: 1,
                        'changed_at' => $startedAt,
                    ]);
                }

                DB::table('task_status_history')->insert([
                    'task_id' => $task->id,
                    'from_status' => $activeStatus,
                    'to_status' => $task->status,
                    'changed_by' => $task->assignee_id ?: $task->creator_id ?: 1,
                    'changed_at' => $task->completed_at,
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_status_history');
    }
};
