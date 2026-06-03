<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add workflow JSON column to status_templates table
        Schema::table('status_templates', function (Blueprint $table) {
            $table->json('workflow')->nullable()->after('statuses');
        });

        // 2. Update existing templates with appropriate default workflows

        // Kanban: todo → in_progress → complete (linear + reopen: complete → todo)
        DB::table('status_templates')
            ->where('name', 'Kanban')
            ->whereNull('created_by')
            ->update(['workflow' => json_encode([
                'mode' => 'unrestricted',
                'transitions' => [
                    ['id' => 't1', 'name' => 'Start Work', 'from' => 'todo', 'to' => 'in_progress', 'allowed_roles' => []],
                    ['id' => 't2', 'name' => 'Complete', 'from' => 'in_progress', 'to' => 'complete', 'allowed_roles' => []],
                    ['id' => 't3', 'name' => 'Reopen', 'from' => 'complete', 'to' => 'todo', 'allowed_roles' => ['manager']],
                ],
                'global_transitions' => [],
            ])]);

        // Scrum: todo → in_progress → dev_done → qa → done (linear + reject: qa → in_progress, reopen: done → todo)
        DB::table('status_templates')
            ->where('name', 'Scrum')
            ->whereNull('created_by')
            ->update(['workflow' => json_encode([
                'mode' => 'unrestricted',
                'transitions' => [
                    ['id' => 't1', 'name' => 'Start Work', 'from' => 'todo', 'to' => 'in_progress', 'allowed_roles' => []],
                    ['id' => 't2', 'name' => 'Dev Complete', 'from' => 'in_progress', 'to' => 'dev_done', 'allowed_roles' => []],
                    ['id' => 't3', 'name' => 'Send to QA', 'from' => 'dev_done', 'to' => 'qa', 'allowed_roles' => []],
                    ['id' => 't4', 'name' => 'QA Pass', 'from' => 'qa', 'to' => 'done', 'allowed_roles' => []],
                    ['id' => 't5', 'name' => 'Reject', 'from' => 'qa', 'to' => 'in_progress', 'allowed_roles' => []],
                    ['id' => 't6', 'name' => 'Reopen', 'from' => 'done', 'to' => 'todo', 'allowed_roles' => ['manager']],
                ],
                'global_transitions' => [],
            ])]);

        // Marketing: concept → writing → designing → review → published (linear + reject: review → writing)
        DB::table('status_templates')
            ->where('name', 'Marketing')
            ->whereNull('created_by')
            ->update(['workflow' => json_encode([
                'mode' => 'unrestricted',
                'transitions' => [
                    ['id' => 't1', 'name' => 'Start Writing', 'from' => 'concept', 'to' => 'writing', 'allowed_roles' => []],
                    ['id' => 't2', 'name' => 'Send to Design', 'from' => 'writing', 'to' => 'designing', 'allowed_roles' => []],
                    ['id' => 't3', 'name' => 'Submit for Review', 'from' => 'designing', 'to' => 'review', 'allowed_roles' => []],
                    ['id' => 't4', 'name' => 'Publish', 'from' => 'review', 'to' => 'published', 'allowed_roles' => ['manager']],
                    ['id' => 't5', 'name' => 'Reject', 'from' => 'review', 'to' => 'writing', 'allowed_roles' => []],
                ],
                'global_transitions' => [],
            ])]);

        // Content: idea → writing → editing → approval → published (linear + reject: approval → writing)
        DB::table('status_templates')
            ->where('name', 'Content')
            ->whereNull('created_by')
            ->update(['workflow' => json_encode([
                'mode' => 'unrestricted',
                'transitions' => [
                    ['id' => 't1', 'name' => 'Start Writing', 'from' => 'idea', 'to' => 'writing', 'allowed_roles' => []],
                    ['id' => 't2', 'name' => 'Send to Editing', 'from' => 'writing', 'to' => 'editing', 'allowed_roles' => []],
                    ['id' => 't3', 'name' => 'Submit for Approval', 'from' => 'editing', 'to' => 'approval', 'allowed_roles' => []],
                    ['id' => 't4', 'name' => 'Publish', 'from' => 'approval', 'to' => 'published', 'allowed_roles' => ['manager']],
                    ['id' => 't5', 'name' => 'Reject', 'from' => 'approval', 'to' => 'writing', 'allowed_roles' => []],
                ],
                'global_transitions' => [],
            ])]);

        // Normal: todo → in_progress → closed (linear + reopen: closed → todo)
        DB::table('status_templates')
            ->where('name', 'Normal')
            ->whereNull('created_by')
            ->update(['workflow' => json_encode([
                'mode' => 'unrestricted',
                'transitions' => [
                    ['id' => 't1', 'name' => 'Start Work', 'from' => 'todo', 'to' => 'in_progress', 'allowed_roles' => []],
                    ['id' => 't2', 'name' => 'Close', 'from' => 'in_progress', 'to' => 'closed', 'allowed_roles' => []],
                    ['id' => 't3', 'name' => 'Reopen', 'from' => 'closed', 'to' => 'todo', 'allowed_roles' => ['manager']],
                ],
                'global_transitions' => [],
            ])]);
    }

    public function down(): void
    {
        Schema::table('status_templates', function (Blueprint $table) {
            $table->dropColumn('workflow');
        });
    }
};
