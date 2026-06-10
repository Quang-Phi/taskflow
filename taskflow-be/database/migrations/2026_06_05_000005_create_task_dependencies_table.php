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
        Schema::create('task_dependencies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('target_task_id');
            $table->enum('type', [
                'blocks',
                'blocked_by',
                'relates_to',
                'duplicates',
                'duplicated_by',
                'clones',
                'cloned_by',
                'causes',
                'caused_by'
            ])->default('relates_to');
            $table->unsignedBigInteger('created_by');
            $table->timestamps();

            $table->foreign('task_id')->references('id')->on('tasks')->onDelete('cascade');
            $table->foreign('target_task_id')->references('id')->on('tasks')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            
            $table->unique(['task_id', 'target_task_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_dependencies');
    }
};
