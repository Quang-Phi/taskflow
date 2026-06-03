<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $userId;
    public array $notification;

    public function __construct(int $userId, array $notification)
    {
        $this->userId = $userId;
        $this->notification = $notification;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('App.Models.User.' . $this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.received';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $n = $this->notification;
        
        $actorName = 'System';
        $actorPhoto = null;
        if (isset($n['actor']['name'])) {
            $actorName = $n['actor']['name'];
            $actorPhoto = $n['actor']['photo'] ?? null;
        } elseif (isset($n['actor_id'])) {
            $actor = \App\Models\User::find($n['actor_id']);
            if ($actor) {
                $actorName = $actor->name;
                $actorPhoto = $actor->photo;
            }
        }
        
        return [
            'notification' => [
                'id' => (int)($n['id'] ?? 0),
                'actor' => [
                    'name' => $actorName,
                    'photo' => $actorPhoto,
                ],
                'action' => $n['action'] ?? '',
                'target' => $n['target'] ?? '',
                'extra' => $n['extra'] ?? null,
                'created_at' => $n['created_at'] ?? now()->toIso8601String(),
                'read' => (bool)($n['read'] ?? false),
                'type' => $n['type'] ?? '',
                'task_id' => isset($n['task_id']) ? (int)$n['task_id'] : null,
                'project_id' => isset($n['project_id']) ? (int)$n['project_id'] : null,
            ]
        ];
    }
}
