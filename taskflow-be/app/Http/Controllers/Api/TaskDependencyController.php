<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\TaskActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TaskDependencyController extends Controller
{
    /**
     * POST /api/tasks/{task}/dependencies
     */
    public function store(Request $request, $taskId): JsonResponse
    {
        $task = Task::find($taskId);
        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $user = $request->user();
        $project = $task->project;

        // Check if user is a member of the project
        $isMember = $project->members->contains($user->id) || $project->created_by === $user->id || $user->role === 'admin';
        if (!$isMember) {
            return response()->json(['success' => false, 'message' => 'Unauthorized – you must be a member of the project to add dependencies'], 403);
        }

        $request->validate([
            'target_task_id' => 'required|exists:tasks,id',
            'type' => 'required|in:blocks,blocked_by,relates_to,duplicates,duplicated_by,clones,cloned_by,causes,caused_by',
        ]);

        $targetTaskId = (int)$request->input('target_task_id');
        $type = $request->input('type');

        if ($targetTaskId === (int)$taskId) {
            return response()->json(['success' => false, 'message' => 'Không thể liên kết một công việc với chính nó.'], 422);
        }

        $targetTask = Task::find($targetTaskId);
        if (!$targetTask) {
            return response()->json(['success' => false, 'message' => 'Target task not found'], 404);
        }

        // Validate that both tasks belong to the same project
        if ((int)$targetTask->project_id !== (int)$task->project_id) {
            return response()->json(['success' => false, 'message' => 'Hai công việc phải thuộc cùng một dự án.'], 422);
        }

        // Check if link already exists
        $existing = TaskDependency::where('task_id', $taskId)
            ->where('target_task_id', $targetTaskId)
            ->where('type', $type)
            ->exists();

        if ($existing) {
            return response()->json(['success' => false, 'message' => 'Liên kết phụ thuộc này đã tồn tại.'], 409);
        }

        // Check for circular dependency if type is 'blocks' or 'blocked_by'
        if (in_array($type, ['blocks', 'blocked_by'])) {
            if ($this->wouldCreateCircularDependency((int)$taskId, $targetTaskId, $type)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phát hiện chu kỳ phụ thuộc (Circular Dependency). Việc liên kết này sẽ làm cho các công việc chặn lẫn nhau và không thể hoàn thành.'
                ], 422);
            }
        }

        // Create the dependency record
        $dependency = TaskDependency::create([
            'task_id' => $taskId,
            'target_task_id' => $targetTaskId,
            'type' => $type,
            'created_by' => $user->id,
        ]);

        // Translate types for activity details
        $typeLabels = [
            'blocks' => 'blocks',
            'blocked_by' => 'is blocked by',
            'relates_to' => 'relates to',
            'duplicates' => 'duplicates',
            'duplicated_by' => 'is duplicated by',
            'clones' => 'clones',
            'cloned_by' => 'is cloned from',
            'causes' => 'causes',
            'caused_by' => 'is caused by'
        ];
        
        $inverseTypes = [
            'blocks' => 'blocked_by',
            'blocked_by' => 'blocks',
            'relates_to' => 'relates_to',
            'duplicates' => 'duplicated_by',
            'duplicated_by' => 'duplicates',
            'clones' => 'cloned_by',
            'cloned_by' => 'clones',
            'causes' => 'caused_by',
            'caused_by' => 'causes'
        ];
        
        $label = $typeLabels[$type] ?? $type;
        $inverseLabel = $typeLabels[$inverseTypes[$type]] ?? $inverseTypes[$type];

        // Log activity on the source task
        TaskActivity::create([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'action' => 'linked_task',
            'details' => "Linked this task ({$label}) to #{$targetTaskId} '{$targetTask->title}'",
        ]);

        // Log activity on the target task
        TaskActivity::create([
            'task_id' => $targetTaskId,
            'user_id' => $user->id,
            'action' => 'linked_task',
            'details' => "Linked this task ({$inverseLabel}) to #{$taskId} '{$task->title}'",
        ]);

        Log::info("User ID {$user->id} linked Task ID {$taskId} to Task ID {$targetTaskId} as {$type}");

        // Load relationships to return
        $dependency->load(['targetTask', 'task', 'creator']);

        return response()->json([
            'success' => true,
            'message' => 'Đã liên kết công việc thành công.',
            'data' => $dependency,
        ], 201);
    }

    /**
     * DELETE /api/task-dependencies/{id}
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $dependency = TaskDependency::find($id);
        if (!$dependency) {
            return response()->json(['success' => false, 'message' => 'Dependency not found'], 404);
        }

        $user = $request->user();
        $task = Task::find($dependency->task_id);
        $targetTask = Task::find($dependency->target_task_id);

        if (!$task || !$targetTask) {
            return response()->json(['success' => false, 'message' => 'Linked task not found'], 404);
        }

        $project = $task->project;
        $isMember = $project->members->contains($user->id) || $project->created_by === $user->id || $user->role === 'admin';

        if (!$isMember) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $type = $dependency->type;
        $dependency->delete();

        // Translate types for activity details
        $typeLabels = [
            'blocks' => 'blocks',
            'blocked_by' => 'is blocked by',
            'relates_to' => 'relates to',
            'duplicates' => 'duplicates',
            'duplicated_by' => 'is duplicated by',
            'clones' => 'clones',
            'cloned_by' => 'is cloned from',
            'causes' => 'causes',
            'caused_by' => 'is caused by'
        ];
        
        $inverseTypes = [
            'blocks' => 'blocked_by',
            'blocked_by' => 'blocks',
            'relates_to' => 'relates_to',
            'duplicates' => 'duplicated_by',
            'duplicated_by' => 'duplicates',
            'clones' => 'cloned_by',
            'cloned_by' => 'clones',
            'causes' => 'caused_by',
            'caused_by' => 'causes'
        ];

        $label = $typeLabels[$type] ?? $type;
        $inverseLabel = $typeLabels[$inverseTypes[$type]] ?? $inverseTypes[$type];

        // Log activity on both tasks
        TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'unlinked_task',
            'details' => "Removed link ({$label}) to #{$targetTask->id} '{$targetTask->title}'",
        ]);

        TaskActivity::create([
            'task_id' => $targetTask->id,
            'user_id' => $user->id,
            'action' => 'unlinked_task',
            'details' => "Removed link ({$inverseLabel}) to #{$task->id} '{$task->title}'",
        ]);

        Log::info("User ID {$user->id} deleted dependency link between Task ID {$task->id} and Task ID {$targetTask->id}");

        return response()->json([
            'success' => true,
            'message' => 'Đã gỡ bỏ liên kết công việc thành công.',
        ]);
    }

    /**
     * DFS based Circular dependency check
     */
    private function wouldCreateCircularDependency(int $taskId, int $targetTaskId, string $type): bool
    {
        // Edge direction: X -> Y means X blocks Y.
        // If type is 'blocks': taskId blocks targetTaskId. So edge: taskId -> targetTaskId.
        // If type is 'blocked_by': targetTaskId blocks taskId. So edge: targetTaskId -> taskId.
        
        $edges = [];
        
        $allDependencies = TaskDependency::whereIn('type', ['blocks', 'blocked_by'])->get();
        
        foreach ($allDependencies as $dep) {
            $u = (int)$dep->task_id;
            $v = (int)$dep->target_task_id;
            
            if ($dep->type === 'blocks') {
                $edges[$u][] = $v;
            } else {
                $edges[$v][] = $u;
            }
        }
        
        // Add the proposed edge
        if ($type === 'blocks') {
            $edges[$taskId][] = $targetTaskId;
        } else {
            $edges[$targetTaskId][] = $taskId;
        }
        
        $startNode = $type === 'blocks' ? $targetTaskId : $taskId;
        $endNode = $type === 'blocks' ? $taskId : $targetTaskId;
        
        return $this->canReach($startNode, $endNode, $edges);
    }

    private function canReach(int $start, int $end, array $edges): bool
    {
        $visited = [];
        $queue = [$start];
        $visited[$start] = true;
        
        while (!empty($queue)) {
            $current = array_shift($queue);
            
            if ($current === $end) {
                return true;
            }
            
            if (isset($edges[$current])) {
                foreach ($edges[$current] as $neighbor) {
                    if (!isset($visited[$neighbor])) {
                        $visited[$neighbor] = true;
                        $queue[] = $neighbor;
                    }
                }
            }
        }
        
        return false;
    }
}
