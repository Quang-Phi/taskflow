<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    /**
     * Search tasks, projects, and users.
     */
    public function search(Request $request): JsonResponse
    {
        $queryClean = trim($request->input('q'));
        // Normalize multiple spaces to a single space
        $queryClean = preg_replace('/\s+/', ' ', $queryClean);

        if (empty($queryClean) || strlen($queryClean) < 2) {
            return response()->json([
                'success' => true,
                'data' => [
                    'tasks' => [],
                    'projects' => [],
                    'members' => [],
                ],
            ]);
        }

        // Generate wildcard pattern by replacing space with % to handle multiple spaces in DB
        $likePattern = '%' . str_replace(' ', '%', $queryClean) . '%';

        // Search Tasks
        $tasks = Task::query()
            ->with(['project', 'assignee'])
            ->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(title) LIKE ?', [$likePattern])
                  ->orWhere('description', 'LIKE', $likePattern)
                  ->orWhere('id', 'LIKE', $likePattern);
            })
            ->limit(10)
            ->get();

        // Search Projects
        $projects = Project::query()
            ->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhere('description', 'LIKE', $likePattern);
            })
            ->limit(10)
            ->get();

        // Search Members (Users)
        $members = User::query()
            ->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(email) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(work_position) LIKE ?', [$likePattern]);
            })
            ->limit(10)
            ->get(['id', 'name', 'email', 'photo', 'work_position', 'role']);

        return response()->json([
            'success' => true,
            'data' => [
                'tasks' => $tasks,
                'projects' => $projects,
                'members' => $members,
            ],
        ]);
    }
}
