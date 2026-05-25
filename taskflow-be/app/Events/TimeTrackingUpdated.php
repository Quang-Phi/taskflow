<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
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

    public function __construct(int $projectId, int $userId, string $action, ?array $timeEntry = null)
    {
        $this->projectId = $projectId;
        $this->userId = $userId;
        $this->action = $action;
        $this->timeEntry = $timeEntry;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('project.' . $this->projectId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'timer.updated';
    }
}
