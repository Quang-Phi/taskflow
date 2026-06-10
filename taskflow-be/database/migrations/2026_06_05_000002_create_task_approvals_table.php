<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
            $table->string('transition_key'); // transition_key from workflow_transitions
            $table->unsignedBigInteger('reviewer_id');
            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->text('comment')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->foreign('reviewer_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_approvals');
    }
};
