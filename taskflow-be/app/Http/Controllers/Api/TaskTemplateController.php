<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\Checklist;
use App\Models\TaskTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $query = TaskTemplate::query();

        if ($projectId) {
            $query->where(function ($q) use ($projectId) {
                $q->where('project_id', $projectId)
                  ->orWhereNull('project_id');
            });
        }

        $templates = $query->with('creator')->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'is_public' => 'nullable|boolean',
            'task_id' => 'nullable|exists:tasks,id',
        ]);

        $checklistTemplate = null;
        $subtaskTemplate = null;
        $description = $request->input('description');
        $type = $request->input('type', 'task');
        $priority = $request->input('priority', 'medium');
        $estimatedHours = $request->input('estimated_hours');

        if ($request->has('task_id')) {
            $taskId = $request->input('task_id');
            $existing = TaskTemplate::where('source_task_id', $taskId)->first();
            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'Công việc này đã được lưu thành mẫu trước đó.',
                ], 422);
            }

            $task = Task::find($taskId);
            if ($task) {
                $description = $task->description;
                $type = $task->type ?: 'task';
                $priority = $task->priority ?: 'medium';
                $estimatedHours = $task->estimated_hours;

                // Load checklists and their items
                $checklists = Checklist::where('task_id', $task->id)->with('items')->get();
                $checklistTemplate = [];
                foreach ($checklists as $checklist) {
                    $items = [];
                    foreach ($checklist->items as $item) {
                        $items[] = [
                            'name' => $item->name,
                            'is_checked' => $item->is_checked,
                            'position' => $item->position,
                        ];
                    }
                    $checklistTemplate[] = [
                        'name' => $checklist->name,
                        'position' => $checklist->position,
                        'items' => $items,
                    ];
                }

                // Load subtasks
                $subtasks = Task::where('parent_task_id', $task->id)->get();
                $subtaskTemplate = [];
                foreach ($subtasks as $subtask) {
                    $subtaskTemplate[] = [
                        'title' => $subtask->title,
                        'description' => $subtask->description,
                        'priority' => $subtask->priority ?: 'medium',
                        'type' => $subtask->type ?: 'task',
                        'estimated_hours' => $subtask->estimated_hours,
                    ];
                }
            }
        } else {
            // Read optional JSON arrays directly if passed in form
            if ($request->has('checklist_template')) {
                $checklistTemplate = $request->input('checklist_template');
            }
            if ($request->has('subtask_template')) {
                $subtaskTemplate = $request->input('subtask_template');
            }
        }

        $template = TaskTemplate::create([
            'project_id' => $request->input('project_id'),
            'name' => $request->input('name'),
            'description' => $description,
            'type' => $type,
            'priority' => $priority,
            'estimated_hours' => $estimatedHours,
            'checklist_template' => $checklistTemplate,
            'subtask_template' => $subtaskTemplate,
            'created_by' => $request->user()->id,
            'is_public' => $request->input('is_public', false),
            'source_task_id' => $request->input('task_id'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template created successfully',
            'data' => $template->load('creator'),
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $template = TaskTemplate::find($id);
        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Template not found',
            ], 404);
        }

        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully',
        ]);
    }
}
