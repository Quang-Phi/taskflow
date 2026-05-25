<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    protected $fillable = [
        'user_id',
        'actor_id',
        'type',
        'action',
        'target',
        'extra',
        'task_id',
        'project_id',
        'read',
    ];

    protected $casts = [
        'read' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Create a notification for a user.
     */
    public static function notify(
        int $userId,
        ?int $actorId,
        string $type,
        string $action,
        string $target,
        ?string $extra = null,
        ?int $taskId = null,
        ?int $projectId = null
    ): ?self {
        // Don't notify yourself
        if ($actorId && $userId === $actorId) {
            return null;
        }

        // Check if user has disabled notifications of this type
        $user = User::find($userId);
        if ($user && is_array($user->notification_settings)) {
            $settingsMap = [
                'task_assigned' => 'taskAssigned',
                'comment' => 'taskComment',
                'mention' => 'taskComment',
                'reply' => 'taskComment',
                'reaction' => 'taskComment',
                'status_changed' => 'projectUpdate',
                'deadline' => 'deadline',
                'evaluation' => 'evaluation',
            ];

            $settingKey = $settingsMap[$type] ?? null;
            if ($settingKey && isset($user->notification_settings[$settingKey]) && $user->notification_settings[$settingKey] === false) {
                return null;
            }
        }

        $notification = self::create([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'type' => $type,
            'action' => $action,
            'target' => $target,
            'extra' => $extra,
            'task_id' => $taskId,
            'project_id' => $projectId,
        ]);

        if ($notification) {
            $notification->load(['actor', 'task', 'project']);
            event(new \App\Events\NotificationReceived((int)$userId, $notification->toArray()));
        }

        return $notification;
    }
}
