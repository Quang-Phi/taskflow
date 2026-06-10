<?php

namespace Tests\Feature;

use App\Models\Evaluation;
use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PureTaskEvaluationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employee;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        // Create admin
        $this->admin = User::create([
            'id' => 1,
            'bitrix_id' => 10001,
            'name' => 'System Admin',
            'email' => 'admin@taskflow.local',
            'role' => 'admin',
            'active' => true,
        ]);

        // Create employee in department 10
        $this->employee = User::create([
            'id' => 2,
            'bitrix_id' => 10002,
            'name' => 'Department Employee',
            'email' => 'emp@taskflow.local',
            'role' => 'employee',
            'department_ids' => [10],
            'active' => true,
        ]);

        // Create project
        $this->project = Project::create([
            'name' => 'Test Project',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'open'],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed']
            ]
        ]);
    }

    public function test_evaluation_generation_computes_score_from_tasks(): void
    {
        // Create 2 tasks for employee in Q2 2026 (May 15th, 2026)
        // Task 1: completed, on-time
        Task::create([
            'project_id' => $this->project->id,
            'title' => 'Task 1',
            'status' => 'done',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'due_date' => '2026-05-15',
            'completed_at' => '2026-05-15 10:00:00',
            'position' => 1
        ]);

        // Task 2: completed, late (due May 14th, completed May 15th)
        Task::create([
            'project_id' => $this->project->id,
            'title' => 'Task 2',
            'status' => 'done',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'due_date' => '2026-05-14',
            'completed_at' => '2026-05-15 10:00:00',
            'position' => 2
        ]);

        // 1. Generate evaluations
        $response = $this->actingAs($this->admin)
            ->postJson('/api/evaluations/generate', [
                'period' => 'Q2 2026',
            ]);

        $response->assertStatus(200);

        // 2. Fetch employee evaluation and assert task performance calculations:
        // Total tasks = 2, Completed tasks = 2
        // On-time tasks = 1
        // On-time rate = 1 / 2 = 50.0%
        // Task Score = (50.0 / 100) * 10 * 0.5 = 2.5
        // Completion Rate = (2 / 2) * 10 * 0.5 = 5.0
        // Expected total_score = 2.5 + 5.0 = 7.5
        $eval = Evaluation::where('employee_id', $this->employee->id)->first();
        $this->assertNotNull($eval);
        $this->assertEquals(2, $eval->total_tasks);
        $this->assertEquals(2, $eval->completed_tasks);
        $this->assertEquals(1, $eval->on_time_tasks);
        $this->assertEquals(50.0, $eval->on_time_rate);
        $this->assertEquals(7.5, $eval->total_score);
    }

    public function test_manager_can_comment_and_publish_evaluation(): void
    {
        // 1. Pre-create evaluation for employee
        $eval = Evaluation::create([
            'period' => 'Q2 2026',
            'employee_id' => $this->employee->id,
            'evaluator_id' => $this->admin->id,
            'total_tasks' => 0,
            'completed_tasks' => 0,
            'on_time_tasks' => 0,
            'on_time_rate' => 0,
            'total_score' => 0,
            'status' => 'draft',
        ]);

        // 2. Update evaluation comment and publish it
        $response = $this->actingAs($this->admin)
            ->putJson("/api/evaluations/{$eval->id}", [
                'comment' => 'Keep up the good work!',
                'publish' => true,
            ]);

        $response->assertStatus(200);

        $eval->refresh();
        $this->assertEquals('Keep up the good work!', $eval->comment);
        $this->assertEquals('published', $eval->status);
        $this->assertNotNull($eval->published_at);
    }

    public function test_evaluation_stats_recalculated_automatically_on_task_changes(): void
    {
        // 1. Pre-create evaluation draft for employee
        $eval = Evaluation::create([
            'period' => 'Q2 2026',
            'employee_id' => $this->employee->id,
            'evaluator_id' => $this->admin->id,
            'total_tasks' => 0,
            'completed_tasks' => 0,
            'on_time_tasks' => 0,
            'on_time_rate' => 0,
            'total_score' => 0,
            'status' => 'draft',
        ]);

        // 2. Create a task in Q2 2026 (May 15th, 2026) for the employee
        $task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Task A',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'due_date' => '2026-05-15',
            'position' => 1
        ]);

        // Evaluation stats should auto-refresh (total_tasks = 1, completed_tasks = 0, on_time_tasks = 0)
        $eval->refresh();
        $this->assertEquals(1, $eval->total_tasks);
        $this->assertEquals(0, $eval->completed_tasks);
        $this->assertEquals(0.0, $eval->total_score);

        // 3. Mark task as completed (done) on time
        $task->status = 'done';
        $task->completed_at = '2026-05-15 10:00:00';
        $task->save();

        // Evaluation stats should auto-refresh (total_tasks = 1, completed_tasks = 1, on_time_tasks = 1, rate = 100.0)
        // Expected score: taskScore (100% on-time) * 10 * 0.5 = 5.0
        // + completionRate (1/1 completed) * 10 * 0.5 = 5.0
        // Total = 10.0
        $eval->refresh();
        $this->assertEquals(1, $eval->total_tasks);
        $this->assertEquals(1, $eval->completed_tasks);
        $this->assertEquals(1, $eval->on_time_tasks);
        $this->assertEquals(100.0, $eval->on_time_rate);
        $this->assertEquals(10.0, $eval->total_score);

        // 4. Delete the task
        $task->delete();

        // Evaluation stats should reset back to 0
        $eval->refresh();
        $this->assertEquals(0, $eval->total_tasks);
        $this->assertEquals(0, $eval->completed_tasks);
        $this->assertEquals(0.0, $eval->total_score);
    }
}
