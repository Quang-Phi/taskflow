<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttachmentController extends Controller
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
            'file' => [
                'required',
                'file',
                'max:20480', // Max 20MB
                'mimes:jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,zip,rar,7z,mp3,mp4,wav,avi'
            ],
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $originalName = $file->getClientOriginalName();
            $filename = time() . '_' . Str::random(8) . '_' . str_replace(' ', '_', $originalName);
            
            // Store file under configured storage folder or S3
            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 'local') {
                $disk = 'public';
            }
            $path = $file->storeAs('task_attachments', $filename, $disk);
            $filePath = $disk === 's3' ? Storage::disk('s3')->url($path) : '/storage/' . $path;

            $attachment = TaskAttachment::create([
                'task_id' => $task->id,
                'user_id' => $user->id,
                'file_name' => $originalName,
                'file_path' => $filePath,
                'file_size' => $file->getSize(),
                'file_type' => $file->getClientMimeType(),
            ]);

            \App\Models\TaskActivity::create([
                'task_id' => $task->id,
                'user_id' => $user->id,
                'action' => 'added_attachment',
                'details' => "Attached file \"{$originalName}\""
            ]);

            return response()->json([
                'success' => true,
                'message' => 'File uploaded successfully',
                'data' => $attachment->load('user')
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'No file provided'
        ], 400);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $attachment = TaskAttachment::find($id);
        if (!$attachment) {
            return response()->json(['success' => false, 'message' => 'Attachment not found'], 404);
        }

        $task = $attachment->task;
        $project = $task->project;
        $user = $request->user();
        $isProjectManager = false;
        $memberRecord = $project->members()->where('users.id', $user->id)->first();
        if ($memberRecord && $memberRecord->pivot && $memberRecord->pivot->role === 'manager') {
            $isProjectManager = true;
        }

        $canUpdate = $user->role === 'admin' 
            || $project->created_by === $user->id
            || (int)$attachment->user_id === (int)$user->id
            || $isProjectManager;

        if (!$canUpdate) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'file_name' => 'required|string|max:255',
        ]);

        $oldName = $attachment->file_name;
        $newName = $request->input('file_name');

        // Prevent bypassing extension validation on rename
        $ext = strtolower(pathinfo($newName, PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'mp3', 'mp4', 'wav', 'avi'];
        if (!in_array($ext, $allowedExts)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid file extension. Allowed: ' . implode(', ', $allowedExts),
            ], 422);
        }
        
        $attachment->file_name = $newName;
        $attachment->save();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'renamed_attachment',
            'details' => "Renamed attachment \"{$oldName}\" to \"{$newName}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Attachment renamed successfully',
            'data' => $attachment->load('user')
        ]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $attachment = TaskAttachment::find($id);
        if (!$attachment) {
            return response()->json(['success' => false, 'message' => 'Attachment not found'], 404);
        }

        $task = $attachment->task;
        $project = $task->project;
        $user = $request->user();
        $isProjectManager = false;
        $memberRecord = $project->members()->where('users.id', $user->id)->first();
        if ($memberRecord && $memberRecord->pivot && $memberRecord->pivot->role === 'manager') {
            $isProjectManager = true;
        }

        $canDelete = $user->role === 'admin' 
            || $project->created_by === $user->id
            || (int)$attachment->user_id === (int)$user->id
            || $isProjectManager;

        if (!$canDelete) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        // Delete from physical storage
        $filePath = $attachment->file_path;
        if (str_starts_with($filePath, 'http://') || str_starts_with($filePath, 'https://')) {
            if (preg_match('/(task_attachments\/[^\?]+)/', $filePath, $matches)) {
                $s3Key = $matches[1];
                if (Storage::disk('s3')->exists($s3Key)) {
                    Storage::disk('s3')->delete($s3Key);
                }
            }
        } else {
            $relativePath = str_replace('/storage/', '', $filePath);
            if (Storage::disk('public')->exists($relativePath)) {
                Storage::disk('public')->delete($relativePath);
            }
        }

        $fileName = $attachment->file_name;
        $attachment->delete();

        \App\Models\TaskActivity::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'deleted_attachment',
            'details' => "Deleted attachment \"{$fileName}\""
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Attachment deleted successfully'
        ]);
    }
}
