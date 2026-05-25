<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomField;
use App\Models\CustomFieldValue;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomFieldController extends Controller
{
    public function index(Request $request, $projectId): JsonResponse
    {
        $project = Project::find($projectId);
        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        $user = $request->user();
        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $fields = $project->customFields;

        return response()->json([
            'success' => true,
            'data' => $fields
        ]);
    }

    public function store(Request $request, $projectId): JsonResponse
    {
        $project = Project::find($projectId);
        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        $user = $request->user();
        $isManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isManager) {
            return response()->json(['success' => false, 'message' => 'Only managers or admins can create custom fields'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:text,textarea,number,dropdown,checkbox,date,money,website,email,phone',
            'options' => 'nullable|array',
        ]);

        $field = CustomField::create([
            'project_id' => $project->id,
            'name' => $request->input('name'),
            'type' => $request->input('type'),
            'options' => $request->input('options'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Custom field created successfully',
            'data' => $field
        ]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $field = CustomField::find($id);
        if (!$field) {
            return response()->json(['success' => false, 'message' => 'Custom field not found'], 404);
        }

        $project = $field->project;
        $user = $request->user();
        $isManager = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->where('role', 'manager')
            ->exists();

        if ($user->role !== 'admin' && $project->created_by !== $user->id && !$isManager) {
            return response()->json(['success' => false, 'message' => 'Only managers or admins can delete custom fields'], 403);
        }

        $field->delete();

        return response()->json([
            'success' => true,
            'message' => 'Custom field deleted successfully'
        ]);
    }

    public function updateValues(Request $request, $taskId): JsonResponse
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
            'field_values' => 'required|array',
            'field_values.*' => 'nullable',
        ]);

        $fieldValues = $request->input('field_values');

        foreach ($fieldValues as $fieldId => $value) {
            $field = CustomField::where('id', $fieldId)->where('project_id', $project->id)->first();
            if (!$field) {
                continue;
            }

            CustomFieldValue::updateOrCreate(
                ['task_id' => $task->id, 'custom_field_id' => $fieldId],
                ['value' => is_array($value) ? json_encode($value) : (string)$value]
            );
        }

        $taskDetails = Task::with(['customFieldValues.customField'])->find($task->id);

        return response()->json([
            'success' => true,
            'message' => 'Custom field values updated successfully',
            'data' => $taskDetails->customFieldValues
        ]);
    }
}
