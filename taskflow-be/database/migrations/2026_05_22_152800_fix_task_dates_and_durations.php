<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Change task date columns from DATE to DATETIME to preserve time portions
        Schema::table('tasks', function (Blueprint $table) {
            $table->dateTime('start_date')->nullable()->change();
            $table->dateTime('due_date')->nullable()->change();
        });

        // Fix existing negative durations in time_entries
        DB::statement('UPDATE time_entries SET duration = ABS(duration) WHERE duration < 0');

        // Fix started_at > ended_at (timezone mismatch from earlier bug)
        // Recalculate duration from actual started_at and ended_at
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('UPDATE time_entries SET duration = ABS(strftime("%s", ended_at) - strftime("%s", started_at)) WHERE ended_at IS NOT NULL');
            // Fix started_at that is after ended_at
            DB::statement('UPDATE time_entries SET started_at = datetime(strftime("%s", ended_at) - ABS(strftime("%s", ended_at) - strftime("%s", started_at)), "unixepoch") WHERE datetime(started_at) > datetime(ended_at) AND ended_at IS NOT NULL');
        } else {
            DB::statement('UPDATE time_entries SET duration = ABS(TIMESTAMPDIFF(SECOND, started_at, ended_at)) WHERE ended_at IS NOT NULL');
            // Fix started_at that is after ended_at (swap them)
            DB::statement('UPDATE time_entries SET started_at = ended_at - INTERVAL ABS(TIMESTAMPDIFF(SECOND, started_at, ended_at)) SECOND WHERE started_at > ended_at AND ended_at IS NOT NULL');
        }

        // Fix negative estimated_hours in tasks
        DB::statement('UPDATE tasks SET estimated_hours = ABS(estimated_hours) WHERE estimated_hours < 0');
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->date('start_date')->nullable()->change();
            $table->date('due_date')->nullable()->change();
        });
    }
};
