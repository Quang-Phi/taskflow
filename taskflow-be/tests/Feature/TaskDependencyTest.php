<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskDependency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskDependencyTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employee;
    protected Project $project;
    protected Task $taskA;
    protected Task $taskB;

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

        // Create employee
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
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'not_started', 'position' => 0],
                ['id' => 'in_progress', 'name' => 'In Progress', 'type' => 'active', 'position' => 1],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed', 'position' => 2]
            ]
        ]);

        // Join project members
        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->employee->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        // Create Task A
        $this->taskA = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Task A',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'position' => 1,
        ]);

        // Create Task B
        $this->taskB = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Task B',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'position' => 2,
        ]);
    }

    public function test_member_can_create_and_delete_dependency(): void
    {
        // 1. Create dependency: A blocks B
        $response = $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskA->id}/dependencies", [
                'target_task_id' => $this->taskB->id,
                'type' => 'blocks',
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);

        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $this->taskA->id,
            'target_task_id' => $this->taskB->id,
            'type' => 'blocks',
        ]);

        $depId = $response->json('data.id');

        // 2. Delete dependency
        $deleteResponse = $this->actingAs($this->employee)
            ->deleteJson("/api/task-dependencies/{$depId}");

        $deleteResponse->assertStatus(200);
        $deleteResponse->assertJsonPath('success', true);

        $this->assertDatabaseMissing('task_dependencies', [
            'id' => $depId,
        ]);
    }

    public function test_cannot_link_task_to_itself_or_different_project(): void
    {
        // 1. Link to itself
        $response1 = $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskA->id}/dependencies", [
                'target_task_id' => $this->taskA->id,
                'type' => 'blocks',
            ]);
        $response1->assertStatus(422);

        // 2. Link to a task in another project
        $project2 = Project::create([
            'name' => 'Project 2',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'not_started', 'position' => 0]
            ]
        ]);
        $taskC = Task::create([
            'project_id' => $project2->id,
            'title' => 'Task C',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'position' => 1,
        ]);

        $response2 = $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskA->id}/dependencies", [
                'target_task_id' => $taskC->id,
                'type' => 'blocks',
            ]);
        $response2->assertStatus(422);
    }

    public function test_circular_dependency_is_blocked(): void
    {
        // 1. A blocks B
        $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskA->id}/dependencies", [
                'target_task_id' => $this->taskB->id,
                'type' => 'blocks',
            ])->assertStatus(201);

        // 2. Try to add B blocks A -> circular dependency!
        $response = $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskB->id}/dependencies", [
                'target_task_id' => $this->taskA->id,
                'type' => 'blocks',
            ]);

        $response->assertStatus(422);
        $response->assertJsonFragment([
            'success' => false,
        ]);
        $this->assertStringContainsString('chu kỳ phụ thuộc', $response->json('message'));
    }

    public function test_workflow_transition_is_blocked_by_incomplete_task(): void
    {
        // 1. B is blocked by A (A blocks B)
        TaskDependency::create([
            'task_id' => $this->taskA->id,
            'target_task_id' => $this->taskB->id,
            'type' => 'blocks',
            'created_by' => $this->admin->id,
        ]);

        // 2. Try to start Task B (move from todo to in_progress) -> should be blocked because A is todo (incomplete)
        $response = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->taskB->id}/status", [
                'status' => 'in_progress',
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('bị chặn bởi công việc chưa hoàn thành', $response->json('message'));

        // 3. Mark Task A as completed (done)
        $this->taskA->status = 'done';
        $this->taskA->completed_at = now();
        $this->taskA->save();

        // 4. Try to start Task B again -> should succeed now
        $successResponse = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->taskB->id}/status", [
                'status' => 'in_progress',
            ]);

        $successResponse->assertStatus(200);
        $this->assertEquals('in_progress', $this->taskB->refresh()->status);
    }

    public function test_admin_is_also_blocked_by_workflow_blocking(): void
    {
        // 1. B is blocked by A
        TaskDependency::create([
            'task_id' => $this->taskA->id,
            'target_task_id' => $this->taskB->id,
            'type' => 'blocks',
            'created_by' => $this->admin->id,
        ]);

        // 2. Admin tries to start Task B -> should be blocked because A is todo (incomplete)
        $response = $this->actingAs($this->admin)
            ->putJson("/api/tasks/{$this->taskB->id}/status", [
                'status' => 'in_progress',
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('bị chặn bởi công việc chưa hoàn thành', $response->json('message'));
        $this->assertEquals('todo', $this->taskB->refresh()->status);
    }

    public function test_task_can_be_cloned(): void
    {
        $response = $this->actingAs($this->employee)
            ->postJson("/api/tasks/{$this->taskA->id}/clone");

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        
        $clonedTaskId = $response->json('data.id');
        $this->assertNotNull($clonedTaskId);
        $this->assertNotEquals($this->taskA->id, $clonedTaskId);
        
        $this->assertDatabaseHas('tasks', [
            'id' => $clonedTaskId,
            'title' => 'Nhân bản của ' . $this->taskA->title,
            'project_id' => $this->project->id,
        ]);

        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $clonedTaskId,
            'target_task_id' => $this->taskA->id,
            'type' => 'clones',
        ]);
    }
}
