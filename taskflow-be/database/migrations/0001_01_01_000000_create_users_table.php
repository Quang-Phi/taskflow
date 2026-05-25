<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('bitrix_id')->unique();
            $table->string('name');
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('photo')->nullable();
            $table->json('department_ids')->nullable();
            $table->string('work_position')->nullable();
            $table->enum('role', ['admin', 'manager', 'employee'])->default('employee');
            $table->boolean('active')->default(true);
            // App settings
            $table->string('theme')->default('dark');
            $table->string('timezone')->default('Asia/Ho_Chi_Minh (UTC+7)');
            $table->string('language')->default('vi');
            $table->string('workspace_name')->default('TaskFlow Inc.');
            $table->json('notification_settings')->nullable();
            // Bitrix OAuth2 tokens
            $table->text('bitrix_access_token')->nullable();
            $table->text('bitrix_refresh_token')->nullable();
            $table->timestamp('bitrix_token_expires')->nullable();
            $table->string('bitrix_domain')->nullable();
            $table->string('bitrix_member_id')->nullable();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
