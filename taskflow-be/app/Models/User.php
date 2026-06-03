<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    public $incrementing = false;

    protected $fillable = [
        'id',
        'bitrix_id',
        'name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'photo',
        'department_ids',
        'work_position',
        'role',
        'active',
        'theme',
        'timezone',
        'language',
        'workspace_name',
        'notification_settings',
        'bitrix_access_token',
        'bitrix_refresh_token',
        'bitrix_token_expires',
        'bitrix_domain',
        'bitrix_member_id',
    ];

    protected $hidden = [
        'bitrix_access_token',
        'bitrix_refresh_token',
    ];

    protected function casts(): array
    {
        return [
            'department_ids' => 'array',
            'active' => 'boolean',
            'bitrix_token_expires' => 'datetime',
            'notification_settings' => 'array',
        ];
    }

    /**
     * Check if Bitrix token is expired.
     */
    public function isBitrixTokenExpired(): bool
    {
        return !$this->bitrix_token_expires || $this->bitrix_token_expires->isPast();
    }

    /**
     * Projects that the user is a member of.
     */
    public function projects()
    {
        return $this->belongsToMany(Project::class, 'project_members')
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }
}
