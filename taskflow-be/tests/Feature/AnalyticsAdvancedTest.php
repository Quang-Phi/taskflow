<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskStatusHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Carbon\Carbon;

class AnalyticsAdvancedTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'id' => 1,
            'bitrix_id' => 10001,
            'name' => 'System Admin',
            'email' => 'admin@taskflow.local',
            'role' => 'admin',
            'active' => true,
        ]);

        $this->project = Project::create([
            'name' => 'Analytics Test Project',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'not_started', 'position' => 0],
                ['id' => 'in_progress', 'name' => 'In Progress', 'type' => 'active', 'position' => 1],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed', 'position' => 2]
            ]
        ]);
    }

    public function test_task_creation_records_status_history(): void
    {
        $task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Analytics Test Task',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->admin->id,
        ]);

        $history = TaskStatusHistory::where('task_id', $task->id)->get();
        $this->assertCount(1, $history);
        $this->assertNull($history[0]->from_status);
        $this->assertEquals('todo', $history[0]->to_status);
    }

    public function test_task_status_update_records_status_history(): void
    {
        $task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Status Change Task',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
        ]);

        $task->update(['status' => 'in_progress']);

        $history = TaskStatusHistory::where('task_id', $task->id)->get();
        $this->assertCount(2, $history);
        
        $this->assertNull($history[0]->from_status);
        $this->assertEquals('todo', $history[0]->to_status);

        $this->assertEquals('todo', $history[1]->from_status);
        $this->assertEquals('in_progress', $history[1]->to_status);
    }

    public function test_analytics_api_returns_process_performance(): void
    {
        // 1. Create a completed task using DB to set exact timestamps
        $taskId = DB::table('tasks')->insertGetId([
            'project_id' => $this->project->id,
            'title' => 'Completed Task',
            'status' => 'done',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'created_at' => Carbon::now()->subDays(5),
            'updated_at' => Carbon::now()->subDays(5),
            'completed_at' => Carbon::now()->subDays(1),
        ]);

        // Manually record transitions in status history
        TaskStatusHistory::create([
            'task_id' => $taskId,
            'from_status' => null,
            'to_status' => 'todo',
            'changed_by' => $this->admin->id,
            'changed_at' => Carbon::now()->subDays(5),
        ]);

        TaskStatusHistory::create([
            'task_id' => $taskId,
            'from_status' => 'todo',
            'to_status' => 'in_progress',
            'changed_by' => $this->admin->id,
            'changed_at' => Carbon::now()->subDays(4),
        ]);

        TaskStatusHistory::create([
            'task_id' => $taskId,
            'from_status' => 'in_progress',
            'to_status' => 'done',
            'changed_by' => $this->admin->id,
            'changed_at' => Carbon::now()->subDays(1),
        ]);

        // 2. Fetch analytics
        $response = $this->actingAs($this->admin)
            ->getJson("/api/analytics/data?project_id={$this->project->id}");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'process_performance' => [
                    'cycle_time_avg',
                    'lead_time_avg',
                    'throughput_weekly_avg',
                    'wip_count',
                    'throughput_trend' => [
                        '*' => ['week', 'throughput']
                    ],
                    'cycle_time_trend' => [
                        '*' => ['week', 'avg_days']
                    ],
                ]
            ]
        ]);

        $perf = $response->json('data.process_performance');
        // Cycle time should be 3 days (sub 1 day - sub 4 days = 3 days = 72 hours)
        $this->assertEquals(3.0, $perf['cycle_time_avg']);
        // Lead time should be 4 days (sub 1 day - sub 5 days = 4 days = 96 hours)
        $this->assertEquals(4.0, $perf['lead_time_avg']);
    }
}
