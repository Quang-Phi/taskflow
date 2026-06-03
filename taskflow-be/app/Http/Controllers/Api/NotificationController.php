<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications?tab=all|unread|mentions|assigned
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tab = $request->input('tab', 'all');
        $perPage = min((int) $request->input('per_page', 20), 50);
        $page = max((int) $request->input('page', 1), 1);

        $query = Notification::with('actor')
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc');

        switch ($tab) {
            case 'unread':
                $query->where('read', false);
                break;
            case 'mentions':
                $query->where('type', 'mention');
                break;
            case 'assigned':
                $query->whereIn('type', ['task_assigned', 'project_added']);
                break;
        }

        $total = (clone $query)->count();

        $notifications = $query
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        $unreadCount = Notification::where('user_id', $user->id)
            ->where('read', false)
            ->count();

        $data = $notifications->map(function ($n) {
            $actorName = $n->actor?->name ?? 'System';
            $initials = $this->getInitials($actorName);
            $colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
            $charSum = array_sum(array_map('ord', str_split($actorName)));

            return [
                'id' => $n->id,
                'user' => $actorName,
                'photo' => $n->actor?->photo,
                'avatar' => $n->type === 'deadline' ? '⏰' : $initials,
                'color' => $n->type === 'deadline' ? '#ef4444' : $colors[$charSum % count($colors)],
                'action' => $n->action,
                'target' => $n->target,
                'extra' => $n->extra,
                'time' => $n->created_at->toIso8601String(),
                'read' => $n->read,
                'type' => $n->type,
                'task_id' => $n->task_id,
                'project_id' => $n->project_id,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'unread_count' => $unreadCount,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'has_more' => ($page * $perPage) < $total,
            ],
        ]);
    }

    /**
     * POST /api/notifications/read
     * Mark notifications as read.
     */
    public function markRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $ids = $request->input('ids'); // array of IDs, or null for all

        $query = Notification::where('user_id', $user->id)->where('read', false);
        if ($ids && is_array($ids)) {
            $query->whereIn('id', $ids);
        }

        $updated = $query->update(['read' => true]);

        return response()->json([
            'success' => true,
            'updated' => $updated,
        ]);
    }

    /**
     * GET /api/notifications/unread-count
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->where('read', false)
            ->count();

        return response()->json(['success' => true, 'count' => $count]);
    }

    private function getInitials(string $name): string
    {
        $parts = explode(' ', trim($name));
        if (count($parts) >= 2) {
            return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1));
        }
        return strtoupper(mb_substr($name, 0, 2));
    }
}
