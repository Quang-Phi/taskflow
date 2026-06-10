<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskAssignmentPermissionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $manager;
    protected User $employee1;
    protected User $employee2;
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

        $this->manager = User::create([
            'id' => 2,
            'bitrix_id' => 10002,
            'name' => 'Project Manager',
            'email' => 'manager@taskflow.local',
            'role' => 'employee',
            'active' => true,
        ]);

        $this->employee1 = User::create([
            'id' => 3,
            'bitrix_id' => 10003,
            'name' => 'Employee One',
            'email' => 'emp1@taskflow.local',
            'role' => 'employee',
            'active' => true,
        ]);

        $this->employee2 = User::create([
            'id' => 4,
            'bitrix_id' => 10004,
            'name' => 'Employee Two',
            'email' => 'emp2@taskflow.local',
            'role' => 'employee',
            'active' => true,
        ]);

        $this->project = Project::create([
            'name' => 'Assignment Project',
            'created_by' => $this->manager->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'not_started', 'position' => 0],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed', 'position' => 1]
            ]
        ]);

        // Add manager to project
        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->manager->id,
            'role' => 'manager',
            'joined_at' => now(),
        ]);

        // Add employee1 to project as member
        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->employee1->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        // Add employee2 to project as member
        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->employee2->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);
    }

    public function test_admin_can_assign_main_task_to_anyone(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Admin Task',
                'assignee_id' => $this->employee1->id,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertEquals($this->employee1->id, $response->json('data.assignee_id'));
    }

    public function test_manager_can_assign_main_task_to_anyone(): void
    {
        $response = $this->actingAs($this->manager)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Manager Task',
                'assignee_id' => $this->employee2->id,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertEquals($this->employee2->id, $response->json('data.assignee_id'));
    }

    public function test_employee_can_assign_main_task_to_themselves(): void
    {
        $response = $this->actingAs($this->employee1)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Self Task',
                'assignee_id' => $this->employee1->id,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertEquals($this->employee1->id, $response->json('data.assignee_id'));
    }

    public function test_employee_cannot_assign_main_task_to_others(): void
    {
        $response = $this->actingAs($this->employee1)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Invalid Assigned Task',
                'assignee_id' => $this->employee2->id,
            ]);

        $response->assertStatus(403);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', 'Standard members can only assign main tasks to themselves.');
    }

    public function test_employee_can_assign_subtask_to_others(): void
    {
        // Create parent task first
        $parentTask = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Parent Task',
            'status' => 'todo',
            'priority' => 'medium',
            'type' => 'task',
            'creator_id' => $this->manager->id,
            'position' => 1,
        ]);

        $response = $this->actingAs($this->employee1)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Subtask',
                'parent_task_id' => $parentTask->id,
                'assignee_id' => $this->employee2->id,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertEquals($this->employee2->id, $response->json('data.assignee_id'));
    }

    public function test_employee_cannot_update_main_task_assignee_to_others(): void
    {
        $task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Self Task',
            'status' => 'todo',
            'priority' => 'medium',
            'type' => 'task',
            'creator_id' => $this->employee1->id,
            'assignee_id' => $this->employee1->id,
            'position' => 1,
        ]);

        $response = $this->actingAs($this->employee1)
            ->putJson("/api/tasks/{$task->id}", [
                'assignee_id' => $this->employee2->id,
            ]);

        $response->assertStatus(403);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('message', 'Standard members can only assign main tasks to themselves.');
    }

    public function test_employee_can_update_subtask_assignee_to_others(): void
    {
        $parentTask = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Parent Task',
            'status' => 'todo',
            'priority' => 'medium',
            'type' => 'task',
            'creator_id' => $this->manager->id,
            'position' => 1,
        ]);

        $subtask = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Subtask',
            'status' => 'todo',
            'priority' => 'medium',
            'type' => 'task',
            'parent_task_id' => $parentTask->id,
            'creator_id' => $this->employee1->id,
            'assignee_id' => $this->employee1->id,
            'position' => 2,
        ]);

        $response = $this->actingAs($this->employee1)
            ->putJson("/api/tasks/{$subtask->id}", [
                'assignee_id' => $this->employee2->id,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertEquals($this->employee2->id, $response->json('data.assignee_id'));
    }
}
