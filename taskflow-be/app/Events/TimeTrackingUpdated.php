<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TimeTrackingUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $projectId;
    public int $userId;
    public string $action; // 'started', 'stopped'
    public ?array $timeEntry;
    public string $serverTime;

    public function __construct(int $projectId, int $userId, string $action, ?array $timeEntry = null)
    {
        $this->projectId = $projectId;
        $this->userId = $userId;
        $this->action = $action;
        $this->timeEntry = $timeEntry;
        $this->serverTime = now()->toIso8601String();
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('project.' . $this->projectId),
            new PrivateChannel('App.Models.User.' . $this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'timer.updated';
    }
}
