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
        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('is_recurring')->default(false);
            $table->string('recurring_frequency')->nullable(); // daily, weekly, monthly, yearly
            $table->integer('recurring_interval')->default(1);
            $table->json('recurring_weekdays')->nullable(); // e.g. [1, 3, 5] for Mon, Wed, Fri (ISO-8601 day of week)
            $table->integer('recurring_monthday')->nullable(); // e.g. 15 for 15th of month
            $table->timestamp('recurring_next_trigger')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn([
                'is_recurring',
                'recurring_frequency',
                'recurring_interval',
                'recurring_weekdays',
                'recurring_monthday',
                'recurring_next_trigger',
            ]);
        });
    }
};
