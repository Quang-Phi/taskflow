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

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $data = $this->taskData;
        if (is_array($data)) {
            if ($this->action === 'comment_created' && isset($data['comment'])) {
                $comment = $data['comment'];
                $user = isset($comment['user']) ? [
                    'id' => $comment['user']['id'] ?? null,
                    'name' => $comment['user']['name'] ?? '',
                    'photo' => $comment['user']['photo'] ?? null,
                ] : null;
                
                $data['comment'] = [
                    'id' => isset($comment['id']) ? (int)$comment['id'] : null,
                    'task_id' => isset($comment['task_id']) ? (int)$comment['task_id'] : null,
                    'parent_id' => isset($comment['parent_id']) ? (int)$comment['parent_id'] : null,
                    'comment' => $comment['comment'] ?? '',
                    'attachment_path' => $comment['attachment_path'] ?? null,
                    'created_at' => $comment['created_at'] ?? null,
                    'user' => $user,
                    'reactions' => $comment['reactions'] ?? [],
                ];
            } elseif ($this->action === 'comment_reacted' && isset($data['reactions'])) {
                $cleanedReactions = [];
                if (is_array($data['reactions'])) {
                    foreach ($data['reactions'] as $reaction) {
                        $cleanedReactions[] = [
                            'id' => $reaction['id'] ?? null,
                            'comment_id' => $reaction['comment_id'] ?? null,
                            'user_id' => $reaction['user_id'] ?? null,
                            'reaction' => $reaction['reaction'] ?? '',
                        ];
                    }
                }
                $data['reactions'] = $cleanedReactions;
            } else {
                unset($data['project']);
                unset($data['subtasks']);
                unset($data['checklists']);
                unset($data['comments']);
                unset($data['activities']);
                unset($data['time_entries']);
                unset($data['attachments']);

                if (isset($data['assignee']) && is_array($data['assignee'])) {
                    $data['assignee'] = [
                        'id' => $data['assignee']['id'] ?? null,
                        'name' => $data['assignee']['name'] ?? '',
                        'photo' => $data['assignee']['photo'] ?? null,
                    ];
                }
                if (isset($data['creator']) && is_array($data['creator'])) {
                    $data['creator'] = [
                        'id' => $data['creator']['id'] ?? null,
                        'name' => $data['creator']['name'] ?? '',
                        'photo' => $data['creator']['photo'] ?? null,
                    ];
                }
            }
        }
        return [
            'action' => $this->action,
            'taskData' => $data,
        ];
    }
}
