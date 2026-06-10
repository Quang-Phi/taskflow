<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflow_transitions', function (Blueprint $table) {
            $table->json('allowed_task_roles')->nullable()->after('allowed_roles'); // ['assignee', 'reviewer', 'reporter']
            $table->boolean('require_all_reviewers')->default(false)->after('allowed_task_roles');
        });
    }

    public function down(): void
    {
        Schema::table('workflow_transitions', function (Blueprint $table) {
            $table->dropColumn(['allowed_task_roles', 'require_all_reviewers']);
        });
    }
};
