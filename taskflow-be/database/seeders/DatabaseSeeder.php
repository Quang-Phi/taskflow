<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['id' => 632],
            [
                'bitrix_id' => 632,
                'name' => 'Admin Phi',
                'first_name' => 'Phi',
                'last_name' => 'Admin',
                'email' => 'sa@esuhai.com',
                'role' => 'admin',
                'active' => true,
            ]
        );

        User::updateOrCreate(
            ['id' => 2],
            [
                'bitrix_id' => 2,
                'name' => 'Trần Nguyễn Đông Ban',
                'first_name' => 'Ban',
                'last_name' => 'Trần Nguyễn Đông',
                'email' => 'ban@esuhai.com',
                'role' => 'employee',
                'active' => true,
            ]
        );
    }
}
