<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WorkflowGuidedTransitionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employee;
    protected Project $project;
    protected Task $task;

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

        $this->employee = User::create([
            'id' => 2,
            'bitrix_id' => 10002,
            'name' => 'Department Employee',
            'email' => 'emp@taskflow.local',
            'role' => 'employee',
            'department_ids' => [10],
            'active' => true,
        ]);

        $this->project = Project::create([
            'name' => 'Test Workflow Project',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'not_started', 'position' => 0],
                ['id' => 'in_progress', 'name' => 'In Progress', 'type' => 'active', 'position' => 1],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed', 'position' => 2]
            ]
        ]);

        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->employee->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $this->task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Main Task',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'position' => 1,
        ]);
    }

    public function test_workflow_failed_rules_format(): void
    {
        // 1. Configure a workflow with restricted mode and field restriction rules
        $workflow = Workflow::create([
            'project_id' => $this->project->id,
            'mode' => 'restricted',
            'initial_status' => 'todo',
        ]);

        // Setup transitions
        $workflow->transitionsRelation()->create([
            'transition_key' => 't_1',
            'name' => 'Start',
            'from' => 'todo',
            'to' => 'in_progress',
        ])->rulesRelation()->create([
            'type' => 'restrict_field',
            'config' => [
                'field' => 'priority',
                'value' => 'urgent',
            ],
        ]);

        // Refresh project to load workflow relation
        $this->project->load('workflow');

        // 2. Try to move status from todo to in_progress with priority medium (should fail)
        $response = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->task->id}/status", [
                'status' => 'in_progress',
            ]);

        $response->assertStatus(422);
        $response->assertJsonPath('workflow_error', true);
        $response->assertJsonStructure([
            'failed_rules' => [
                '*' => ['type', 'message', 'details']
            ]
        ]);

        $failedRules = $response->json('failed_rules');
        $this->assertCount(1, $failedRules);
        $this->assertEquals('restrict_field', $failedRules[0]['type']);
        $this->assertEquals('priority', $failedRules[0]['details']['field']);
        $this->assertEquals('urgent', $failedRules[0]['details']['required_value']);
    }

    public function test_workflow_checklist_validation_on_close(): void
    {
        // 1. Create a checklist item under the task
        $checklist = $this->task->checklists()->create(['name' => 'Task Checklist']);
        $checklistItem = $checklist->items()->create([
            'name' => 'Item 1',
            'is_checked' => false,
            'position' => 1,
        ]);

        // 2. Try to move task directly to done (closed status type)
        $response = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->task->id}/status", [
                'status' => 'done',
            ]);

        // Should return checklist failure
        $response->assertStatus(422);
        $response->assertJsonPath('workflow_error', true);
        
        $failedRules = $response->json('failed_rules');
        $this->assertNotEmpty($failedRules);
        
        $checklistRule = collect($failedRules)->firstWhere('type', 'checklist');
        $this->assertNotNull($checklistRule);
        $this->assertEquals(1, $checklistRule['details']['total_items']);
        $this->assertEquals(0, $checklistRule['details']['checked_items']);
        $this->assertCount(1, $checklistRule['details']['unchecked_items']);
        $this->assertEquals($checklistItem->id, $checklistRule['details']['unchecked_items'][0]['id']);

        // 3. Mark the checklist item as checked
        $checklistItem->update(['is_checked' => true]);

        // 4. Try again -> should transition successfully now
        $successResponse = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->task->id}/status", [
                'status' => 'done',
            ]);

        $successResponse->assertStatus(200);
        $this->assertEquals('done', $this->task->refresh()->status);
    }
}
