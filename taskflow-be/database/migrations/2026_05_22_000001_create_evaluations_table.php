<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluations', function (Blueprint $table) {
            $table->id();
            $table->string('period');                    // e.g. "Q2 2026"
            $table->unsignedBigInteger('employee_id');   // local user id being evaluated
            $table->unsignedBigInteger('evaluator_id');  // local user id of manager/admin

            // Task stats snapshot (computed at creation/update time)
            $table->integer('total_tasks')->default(0);
            $table->integer('completed_tasks')->default(0);
            $table->integer('on_time_tasks')->default(0);
            $table->float('on_time_rate')->default(0);

            // Criteria scores (1-10 each)
            $table->float('score_quality')->default(0);
            $table->float('score_responsibility')->default(0);
            $table->float('score_communication')->default(0);
            $table->float('score_creativity')->default(0);
            $table->float('score_discipline')->default(0);

            // Computed total score
            $table->float('total_score')->default(0);

            // Manager's comment
            $table->text('comment')->nullable();

            // Status: draft or published
            $table->string('status')->default('draft'); // draft | published

            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('evaluator_id')->references('id')->on('users')->onDelete('cascade');

            // One evaluation per employee per period
            $table->unique(['period', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluations');
    }
};
