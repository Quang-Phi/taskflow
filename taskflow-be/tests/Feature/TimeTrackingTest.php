<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\TimeEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TimeTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employeeA;
    protected User $employeeB;
    protected Project $project;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        // Create admin
        $this->admin = User::create([
            'id' => 1,
            'bitrix_id' => 10001,
            'name' => 'Admin User',
            'email' => 'admin@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'admin',
        ]);

        // Create employee A
        $this->employeeA = User::create([
            'id' => 2,
            'bitrix_id' => 10002,
            'name' => 'Employee A',
            'email' => 'a@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'employee',
        ]);

        // Create employee B
        $this->employeeB = User::create([
            'id' => 3,
            'bitrix_id' => 10003,
            'name' => 'Employee B',
            'email' => 'b@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'employee',
        ]);

        // Create project
        $this->project = Project::create([
            'name' => 'Test Project',
            'description' => 'Test Description',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'open'],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed']
            ]
        ]);

        // Attach employees to project
        $this->project->members()->attach($this->employeeA->id, ['role' => 'member']);
        $this->project->members()->attach($this->employeeB->id, ['role' => 'member']);

        // Create task assigned to employee A
        $this->task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Test Task',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employeeA->id,
            'position' => 1
        ]);
    }

    public function test_timer_stops_on_reassignment(): void
    {
        // 1. Create a running timer for Employee A on the task
        $timeEntry = TimeEntry::create([
            'task_id' => $this->task->id,
            'user_id' => $this->employeeA->id,
            'started_at' => now()->subMinutes(10), // started 10 mins ago
            'ended_at' => null,
            'duration' => 0,
        ]);

        // 2. Reassign task to Employee B (as Admin)
        $response = $this->actingAs($this->admin)
            ->putJson("/api/tasks/{$this->task->id}", [
                'assignee_id' => $this->employeeB->id,
            ]);

        $response->assertStatus(200);

        // 3. Assert task assignee updated in DB
        $this->task->refresh();
        $this->assertEquals($this->employeeB->id, $this->task->assignee_id);

        // 4. Assert Employee A's running timer was stopped
        $timeEntry->refresh();
        $this->assertNotNull($timeEntry->ended_at);
        $this->assertGreaterThan(590, $timeEntry->duration); // Should be around 600 seconds
        $this->assertLessThan(610, $timeEntry->duration);
    }

    public function test_update_task_dates(): void
    {
        $response = $this->actingAs($this->admin)
            ->putJson("/api/tasks/{$this->task->id}", [
                'start_date' => '2026-05-25T16:24:43.000Z',
                'due_date' => '2026-05-26T16:24:43.000Z',
            ]);

        $response->assertStatus(200);
    }

    public function test_update_task_start_date_only(): void
    {
        $response = $this->actingAs($this->admin)
            ->putJson("/api/tasks/{$this->task->id}", [
                'start_date' => '2026-05-25T16:24:43.000Z',
                'due_date' => null,
            ]);

        $response->assertStatus(200);
    }

    public function test_timer_stops_when_task_completed(): void
    {
        // 1. Create a running timer for Employee A on the task
        $timeEntry = TimeEntry::create([
            'task_id' => $this->task->id,
            'user_id' => $this->employeeA->id,
            'started_at' => now()->subMinutes(15), // started 15 mins ago
            'ended_at' => null,
            'duration' => 0,
        ]);

        // 2. Update task status to done (a closed status)
        $response = $this->actingAs($this->employeeA)
            ->putJson("/api/tasks/{$this->task->id}", [
                'status' => 'done',
            ]);

        $response->assertStatus(200);

        // 3. Assert task status is 'done'
        $this->task->refresh();
        $this->assertEquals('done', $this->task->status);

        // 4. Assert running timer was stopped and duration calculated
        $timeEntry->refresh();
        $this->assertNotNull($timeEntry->ended_at);
        $this->assertGreaterThan(890, $timeEntry->duration); // Should be around 900 seconds
        $this->assertLessThan(910, $timeEntry->duration);

        // 5. Assert TaskActivity was created
        $this->assertDatabaseHas('task_activities', [
            'task_id' => $this->task->id,
            'user_id' => $this->employeeA->id,
            'action' => 'stopped_timer',
        ]);
    }
}


