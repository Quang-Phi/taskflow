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

    /**
     * Accessor and Mutator for bitrix_access_token with plaintext fallback.
     */
    protected function bitrixAccessToken(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::make(
            get: function ($value) {
                if (empty($value)) return null;
                try {
                    return decrypt($value);
                } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
                    return $value;
                }
            },
            set: fn ($value) => $value ? encrypt($value) : null,
        );
    }

    /**
     * Accessor and Mutator for bitrix_refresh_token with plaintext fallback.
     */
    protected function bitrixRefreshToken(): \Illuminate\Database\Eloquent\Casts\Attribute
    {
        return \Illuminate\Database\Eloquent\Casts\Attribute::make(
            get: function ($value) {
                if (empty($value)) return null;
                try {
                    return decrypt($value);
                } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
                    return $value;
                }
            },
            set: fn ($value) => $value ? encrypt($value) : null,
        );
    }

    /**
     * Get IDs of users managed by this user (including subordinates recursively).
     */
    public function getManagedUserIds(): array
    {
        if (in_array($this->role, ['admin', 'superadmin'])) {
            return self::pluck('id')->toArray();
        }

        if ($this->role === 'employee') {
            return [$this->id];
        }

        // For manager
        $managedDeptIds = [];
        try {
            $bitrix = app(\App\Services\BitrixService::class);
            $bitrix->ensureValidToken($this);
            $departments = $bitrix->getDepartments();
            foreach ($departments as $dept) {
                $headId = $dept['UF_HEAD'] ?? null;
                if ($headId && (int)$headId === (int)$this->id) {
                    $managedDeptIds[] = (int)$dept['ID'];
                }
            }

            // Recursively get sub-departments
            if (!empty($managedDeptIds)) {
                $allManagedIds = $managedDeptIds;
                $added = true;
                while ($added) {
                    $added = false;
                    foreach ($departments as $dept) {
                        $deptId = (int)$dept['ID'];
                        $parentId = isset($dept['PARENT']) ? (int)$dept['PARENT'] : null;
                        if ($parentId && in_array($parentId, $allManagedIds, true) && !in_array($deptId, $allManagedIds, true)) {
                            $allManagedIds[] = $deptId;
                            $added = true;
                        }
                    }
                }
                $managedDeptIds = $allManagedIds;
            }
        } catch (\Exception $e) {
            $managedDeptIds = $this->department_ids ?? [];
        }

        $query = self::query();
        $query->where(function ($q) use ($managedDeptIds) {
            $q->where('id', $this->id);
            foreach ($managedDeptIds as $deptId) {
                $q->orWhereJsonContains('department_ids', (int)$deptId);
            }
        });

        return $query->pluck('id')->toArray();
    }
}
