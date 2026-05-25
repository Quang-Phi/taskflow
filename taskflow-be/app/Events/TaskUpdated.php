<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $projectId;
    public string $action; // 'created', 'updated', 'deleted'
    public ?array $taskData;

    public function __construct(int $projectId, string $action, ?array $taskData = null)
    {
        $this->projectId = $projectId;
        $this->action = $action;
        $this->taskData = $taskData;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('project.' . $this->projectId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'task.updated';
    }
}
