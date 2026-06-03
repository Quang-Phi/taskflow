<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChecklistController extends Controller
{
    public function store(Request $request, $taskId): JsonResponse
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
            'name' => 'required|string|max:255',
        ]);

        $position = Checklist::where('task_id', $task->id)->max('position') + 1;

        $checklist = Checklist::create([
            'task_id' => $task->id,
            'name' => $request->input('name'),
            'position' => $position,
        ]);

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'created_checklist',
            'details' => "Created checklist: \"{$checklist->name}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist created successfully',
            'data' => $checklist->load('items')
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $checklist = Checklist::find($id);
        if (!$checklist) {
            return response()->json(['success' => false, 'message' => 'Checklist not found'], 404);
        }

        $task = $checklist->task;
        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $checklist->name = $request->input('name');
        $checklist->save();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'updated_checklist',
            'details' => "Renamed checklist to \"{$checklist->name}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist updated successfully',
            'data' => $checklist->load('items')
        ]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $checklist = Checklist::find($id);
        if (!$checklist) {
            return response()->json(['success' => false, 'message' => 'Checklist not found'], 404);
        }

        $task = $checklist->task;
        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $checklistName = $checklist->name;
        $checklist->delete();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'deleted_checklist',
            'details' => "Deleted checklist \"{$checklistName}\"."
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist deleted successfully'
        ]);
    }

    public function storeItem(Request $request, $checklistId): JsonResponse
    {
        $checklist = Checklist::find($checklistId);
        if (!$checklist) {
            return response()->json(['success' => false, 'message' => 'Checklist not found'], 404);
        }

        $task = $checklist->task;
        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'assignee_id' => 'nullable|exists:users,id',
        ]);

        $position = ChecklistItem::where('checklist_id', $checklist->id)->max('position') + 1;

        $item = ChecklistItem::create([
            'checklist_id' => $checklist->id,
            'name' => $request->input('name'),
            'assignee_id' => $request->input('assignee_id'),
            'is_checked' => false,
            'position' => $position,
        ]);

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'created_checklist_item',
            'details' => "Added item \"{$item->name}\" to checklist \"{$checklist->name}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist item created successfully',
            'data' => $item->load('assignee')
        ]);
    }

    public function updateItem(Request $request, $id): JsonResponse
    {
        $item = ChecklistItem::find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Checklist item not found'], 404);
        }

        $checklist = $item->checklist;
        $task = $checklist->task;
        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'is_checked' => 'sometimes|boolean',
            'assignee_id' => 'nullable|exists:users,id',
        ]);

        $oldChecked = $item->is_checked;
        $oldName = $item->name;

        if ($request->has('name')) {
            $item->name = $request->input('name');
        }
        if ($request->has('is_checked')) {
            $item->is_checked = $request->input('is_checked');
        }
        if ($request->has('assignee_id')) {
            $item->assignee_id = $request->input('assignee_id');
        }

        $item->save();

        $activityDetails = null;
        if ($request->has('is_checked') && $oldChecked != $item->is_checked) {
            $status = $item->is_checked ? 'checked' : 'unchecked';
            $activityDetails = "Marked item \"{$item->name}\" as {$status}";
        } else if ($request->has('name') && $oldName !== $item->name) {
            $activityDetails = "Renamed checklist item \"{$oldName}\" to \"{$item->name}\"";
        } else {
            $activityDetails = "Updated item \"{$item->name}\" in checklist \"{$checklist->name}\"";
        }

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'updated_checklist_item',
            'details' => $activityDetails
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist item updated successfully',
            'data' => $item->load('assignee')
        ]);
    }

    public function destroyItem(Request $request, $id): JsonResponse
    {
        $item = ChecklistItem::find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Checklist item not found'], 404);
        }

        $checklist = $item->checklist;
        $task = $checklist->task;
        $project = $task->project;
        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $itemName = $item->name;
        $checklistName = $checklist->name;
        $item->delete();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'deleted_checklist_item',
            'details' => "Deleted item \"{$itemName}\" from checklist \"{$checklistName}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Checklist item deleted successfully'
        ]);
    }

    public function convertItem(Request $request, $id): JsonResponse
    {
        $item = ChecklistItem::find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Checklist item not found'], 404);
        }

        $checklist = $item->checklist;
        $parentTask = $checklist->task;
        $project = $parentTask->project;
        $user = $request->user();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'type' => 'required|string|in:task,subtask',
        ]);

        $type = $request->input('type');

        return DB::transaction(function () use ($item, $parentTask, $project, $user, $type) {
            // Create the new Task or Subtask
            $taskData = [
                'project_id' => $project->id,
                'title' => $item->name,
                'description' => null,
                'status' => 'todo',
                'priority' => 'medium',
                'creator_id' => $user->id,
                'assignee_id' => $item->assignee_id ?: $parentTask->assignee_id,
            ];

            if ($type === 'subtask') {
                $taskData['parent_task_id'] = $parentTask->id;
            }

            $newTask = Task::create($taskData);

            // Delete the checklist item
            $item->delete();

            \App\Models\TaskActivity::create([
                'task_id' => $parentTask->id,
                'user_id' => $user->id,
                'action' => 'converted_checklist_item',
                'details' => "Converted item \"{$item->name}\" to {$type}"
            ]);

            return response()->json([
                'success' => true,
                'message' => "Converted checklist item to " . $type . " successfully",
                'data' => $newTask->load('assignee', 'creator')
            ]);
        });
    }
}
