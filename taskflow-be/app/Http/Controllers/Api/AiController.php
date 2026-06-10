<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Services\OpenAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AiController extends Controller
{
    protected OpenAiService $openAiService;

    public function __construct(OpenAiService $openAiService)
    {
        $this->openAiService = $openAiService;
    }

    /**
     * POST /api/tasks/{id}/ai/checklist
     */
    public function generateChecklist(Request $request, $taskId): JsonResponse
    {
        @set_time_limit(120);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $additionalPrompt = $request->input('prompt');

        $items = $request->input('items');
        if (is_array($items)) {
            $items = array_filter(array_map('strval', $items));
        } else {
            $items = [];
        }

        if (empty($items)) {
            // Call OpenAI service
            $items = $this->openAiService->generateChecklist($task->title, $task->description, $additionalPrompt);
            if (empty($items)) {
                return response()->json(['success' => false, 'message' => 'No checklist items generated'], 422);
            }
        }

        $preview = filter_var($request->input('preview', false), FILTER_VALIDATE_BOOLEAN);
        if ($preview) {
            return response()->json([
                'success' => true,
                'data' => $items
            ]);
        }

        $lang = $request->header('X-Language', 'vi');
        $checklistTitle = match ($lang) {
            'en' => '✨ AI Suggested Checklist',
            'ja' => '✨ AIが提案したチェックリスト',
            default => '✨ Checklist gợi ý từ AI',
        };

        // Write to database
        $checklist = DB::transaction(function () use ($task, $items, $checklistTitle) {
            $position = Checklist::where('task_id', $task->id)->max('position') + 1;
            
            $checklist = Checklist::create([
                'task_id' => $task->id,
                'name' => $checklistTitle,
                'position' => $position,
            ]);

            foreach ($items as $idx => $itemName) {
                ChecklistItem::create([
                    'checklist_id' => $checklist->id,
                    'name' => trim($itemName),
                    'is_checked' => false,
                    'position' => $idx + 1,
                ]);
            }

            return $checklist;
        });

        return response()->json([
            'success' => true,
            'message' => 'AI checklist generated successfully',
            'data' => $checklist->load('items.assignee')
        ]);
    }

    /**
     * POST /api/tasks/{id}/ai/chat
     */
    public function chat(Request $request, $taskId)
    {
        @set_time_limit(120);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $task = Task::with(['project', 'assignee', 'comments.user'])->find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'messages' => 'required|array|max:20',
            'messages.*.role' => 'required|string|in:user,ai',
            'messages.*.content' => 'required|string|max:10000',
        ]);

        $messages = $request->input('messages');

        // Prepare task context details
        $taskDetails = [
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'priority' => $task->priority,
            'assignee' => $task->assignee ? ['name' => $task->assignee->name] : null,
            'project' => $task->project ? ['name' => $task->project->name] : null,
            'comments' => $task->comments->map(function ($c) {
                return [
                    'content' => $c->content,
                    'user' => ['name' => $c->user ? $c->user->name : 'Unknown']
                ];
            })->toArray()
        ];

        if ($request->input('stream')) {
            return response()->stream(function () use ($messages, $taskDetails) {
                try {
                    $this->openAiService->chatStream($messages, $taskDetails, function ($chunk) {
                        echo "data: " . json_encode($chunk) . "\n\n";
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    });
                } catch (\Exception $e) {
                    echo "data: " . json_encode(['error' => $e->getMessage()]) . "\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        // Call OpenAI service
        $reply = $this->openAiService->chat($messages, $taskDetails);

        return response()->json([
            'success' => true,
            'reply' => $reply
        ]);
    }

    /**
     * POST /api/ai/global/chat
     */
    public function globalChat(Request $request)
    {
        @set_time_limit(180);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $request->validate([
            'messages' => 'required|array|max:20',
            'messages.*.role' => 'required|string|in:user,ai',
            'messages.*.content' => 'required|string|max:10000',
        ]);

        $messages = $request->input('messages');
        $user = $request->user();

        if ($request->input('stream')) {
            return response()->stream(function () use ($messages, $user) {
                try {
                    $result = $this->openAiService->globalChatStream($messages, $user, function ($chunk) {
                        echo "data: " . json_encode($chunk) . "\n\n";
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    });

                    $finalPayload = [
                        'done' => true,
                        'reply' => $result['reply'] ?? '',
                        'actions' => $result['actions'] ?? [],
                        'events' => $result['events'] ?? []
                    ];
                    echo "data: " . json_encode($finalPayload) . "\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                } catch (\Exception $e) {
                    echo "data: " . json_encode(['error' => $e->getMessage()]) . "\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            }, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);
        }

        // Call OpenAI service globalChat handler
        $result = $this->openAiService->globalChat($messages, $user);

        return response()->json([
            'success' => true,
            'reply' => $result['reply'],
            'actions' => $result['actions'] ?? [],
            'events' => $result['events'] ?? []
        ]);
    }

    /**
     * POST /api/tasks/{id}/ai/subtasks
     */
    public function generateSubtasks(Request $request, $taskId): JsonResponse
    {
        @set_time_limit(120);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $additionalPrompt = $request->input('prompt');

        $titles = $request->input('subtasks');
        if (is_array($titles)) {
            $titles = array_filter(array_map('strval', $titles));
        } else {
            $titles = [];
        }

        if (empty($titles)) {
            // Call OpenAI service
            $titles = $this->openAiService->generateSubtasks($task->title, $task->description, $additionalPrompt);
            if (empty($titles)) {
                return response()->json(['success' => false, 'message' => 'No subtasks generated'], 422);
            }
        }

        $preview = filter_var($request->input('preview', false), FILTER_VALIDATE_BOOLEAN);
        if ($preview) {
            return response()->json([
                'success' => true,
                'data' => $titles
            ]);
        }

        $defaultStatus = $project->statuses[0]['id'] ?? 'todo';
        $createdSubtasks = [];

        DB::transaction(function () use ($task, $titles, $defaultStatus, $user, &$createdSubtasks) {
            $maxPosition = Task::where('project_id', $task->project_id)
                ->where('status', $defaultStatus)
                ->max('position') ?? 0;

            foreach ($titles as $idx => $title) {
                $subtask = Task::create([
                    'project_id' => $task->project_id,
                    'title' => trim($title),
                    'description' => null,
                    'status' => $defaultStatus,
                    'priority' => 'medium',
                    'assignee_id' => null,
                    'creator_id' => $user->id,
                    'parent_task_id' => $task->id,
                    'position' => $maxPosition + $idx + 1,
                ]);

                \App\Models\TaskActivity::create([
                    'task_id' => $subtask->id,
                    'user_id' => $user->id,
                    'action' => 'created',
                    'details' => 'Tạo tự động bằng AI gợi ý.'
                ]);

                $createdSubtasks[] = $subtask;
            }
        });

        // Broadcast task update
        $updatedTask = Task::with(['assignee', 'creator', 'labels', 'subtasks', 'comments.user', 'checklists.items.assignee', 'attachments'])->find($taskId);
        $taskArray = $updatedTask->toArray();
        if (isset($taskArray['project'])) {
            unset($taskArray['project']);
        }
        event(new \App\Events\TaskUpdated((int)$task->project_id, 'updated', $taskArray));

        return response()->json([
            'success' => true,
            'message' => 'AI subtasks generated successfully',
            'data' => $updatedTask->subtasks
        ]);
    }

    /**
     * POST /api/tasks/{id}/ai/description
     */
    public function generateDescription(Request $request, $taskId): JsonResponse
    {
        @set_time_limit(120);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $additionalPrompt = $request->input('prompt');

        $description = $request->input('description');
        if ($description === null) {
            // Call OpenAI service
            $description = $this->openAiService->generateDescription($task->title, $additionalPrompt);
        }

        $preview = filter_var($request->input('preview', false), FILTER_VALIDATE_BOOLEAN);
        if ($preview) {
            return response()->json([
                'success' => true,
                'data' => $description
            ]);
        }

        // Update task description
        $task->description = $description;
        $task->save();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'updated_description',
            'details' => 'Cập nhật mô tả tự động bằng AI.'
        ]);

        // Broadcast task update
        $updatedTask = Task::with(['assignee', 'creator', 'labels', 'subtasks', 'comments.user', 'checklists.items.assignee', 'attachments'])->find($taskId);
        $taskArray = $updatedTask->toArray();
        if (isset($taskArray['project'])) {
            unset($taskArray['project']);
        }
        event(new \App\Events\TaskUpdated((int)$task->project_id, 'updated', $taskArray));

        return response()->json([
            'success' => true,
            'message' => 'AI description generated successfully',
            'data' => $description
        ]);
    }
}
