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
        Schema::create('task_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained('projects')->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type')->default('task');
            $table->string('priority')->default('medium');
            $table->decimal('estimated_hours', 8, 2)->nullable();
            $table->json('checklist_template')->nullable();
            $table->json('subtask_template')->nullable();
            $table->json('custom_field_defaults')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_templates');
    }
};
