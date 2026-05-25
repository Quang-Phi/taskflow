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
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'prompt' => 'nullable|string|max:1000',
        ]);

        $additionalPrompt = $request->input('prompt');

        // Call OpenAI service
        $items = $this->openAiService->generateChecklist($task->title, $task->description, $additionalPrompt);

        if (empty($items)) {
            return response()->json(['success' => false, 'message' => 'No checklist items generated'], 422);
        }

        $lang = $request->header('X-Language', 'vi');
        $checklistTitle = $lang === 'en' ? '✨ AI Suggested Checklist' : '✨ Checklist gợi ý từ AI';

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
    public function chat(Request $request, $taskId): JsonResponse
    {
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
            'messages' => 'required|array',
            'messages.*.role' => 'required|string|in:user,ai',
            'messages.*.content' => 'required|string',
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
    public function globalChat(Request $request): JsonResponse
    {
        $request->validate([
            'messages' => 'required|array',
            'messages.*.role' => 'required|string|in:user,ai',
            'messages.*.content' => 'required|string',
        ]);

        $messages = $request->input('messages');
        $user = $request->user();

        // Call OpenAI service globalChat handler
        $result = $this->openAiService->globalChat($messages, $user);

        return response()->json([
            'success' => true,
            'reply' => $result['reply'],
            'actions' => $result['actions'] ?? [],
            'events' => $result['events'] ?? []
        ]);
    }
}
