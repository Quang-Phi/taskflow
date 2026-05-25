<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Change priority from enum to string to support 'urgent' and future values
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('priority', 50)->default('medium')->change();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('priority', 50)->default('medium')->change();
        });
    }
};
