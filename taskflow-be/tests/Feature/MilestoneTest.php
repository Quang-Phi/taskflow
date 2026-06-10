<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\Milestone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MilestoneTest extends TestCase
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

        DB::table('project_members')->insert([
            'project_id' => $this->project->id,
            'user_id' => $this->employee->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $this->task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Feature Implementation',
            'description' => 'Implement some core user features.',
            'status' => 'todo',
            'priority' => 'high',
            'type' => 'task',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'position' => 1,
        ]);
    }

    public function test_can_crud_milestone(): void
    {
        // 1. Create milestone
        $response = $this->actingAs($this->admin)
            ->postJson("/api/projects/{$this->project->id}/milestones", [
                'name' => 'Sprint 1',
                'description' => 'First sprint description',
                'goal' => 'Achieve MVP milestone',
                'start_date' => '2026-06-01',
                'due_date' => '2026-06-15',
                'status' => 'planned',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $milestoneId = $response->json('data.id');

        $this->assertDatabaseHas('milestones', [
            'id' => $milestoneId,
            'name' => 'Sprint 1',
            'status' => 'planned',
        ]);

        // 2. Read milestones list
        $responseList = $this->actingAs($this->admin)
            ->getJson("/api/projects/{$this->project->id}/milestones");

        $responseList->assertStatus(200);
        $responseList->assertJsonCount(1, 'data');

        // 3. Show milestone details
        $responseShow = $this->actingAs($this->admin)
            ->getJson("/api/milestones/{$milestoneId}");

        $responseShow->assertStatus(200);
        $responseShow->assertJsonPath('data.name', 'Sprint 1');

        // 4. Update milestone status to completed (should set completed_at)
        $responseUpdate = $this->actingAs($this->admin)
            ->putJson("/api/milestones/{$milestoneId}", [
                'status' => 'completed',
            ]);

        $responseUpdate->assertStatus(200);
        $milestone = Milestone::find($milestoneId);
        $this->assertEquals('completed', $milestone->status);
        $this->assertNotNull($milestone->completed_at);

        // 5. Delete milestone
        $responseDelete = $this->actingAs($this->admin)
            ->deleteJson("/api/milestones/{$milestoneId}");

        $responseDelete->assertStatus(200);
        $this->assertDatabaseMissing('milestones', [
            'id' => $milestoneId,
        ]);
    }

    public function test_can_assign_and_remove_tasks_from_milestone(): void
    {
        $milestone = Milestone::create([
            'project_id' => $this->project->id,
            'name' => 'Sprint 2',
            'status' => 'active',
            'created_by' => $this->admin->id,
        ]);

        // Assign task
        $responseAssign = $this->actingAs($this->admin)
            ->postJson("/api/milestones/{$milestone->id}/tasks", [
                'task_ids' => [$this->task->id],
            ]);

        $responseAssign->assertStatus(200);
        $this->assertEquals($milestone->id, $this->task->fresh()->milestone_id);

        // Remove task
        $responseRemove = $this->actingAs($this->admin)
            ->postJson("/api/milestones/{$milestone->id}/tasks/remove", [
                'task_ids' => [$this->task->id],
            ]);

        $responseRemove->assertStatus(200);
        $this->assertNull($this->task->fresh()->milestone_id);
    }

    public function test_can_get_burndown_chart_data(): void
    {
        $milestone = Milestone::create([
            'project_id' => $this->project->id,
            'name' => 'Sprint 3',
            'status' => 'active',
            'start_date' => '2026-06-01',
            'due_date' => '2026-06-10',
            'created_by' => $this->admin->id,
        ]);

        $this->task->update([
            'milestone_id' => $milestone->id,
            'estimated_hours' => 8,
        ]);

        $responseBurndown = $this->actingAs($this->admin)
            ->getJson("/api/milestones/{$milestone->id}/burndown");

        $responseBurndown->assertStatus(200);
        $responseBurndown->assertJsonPath('success', true);
        
        $data = $responseBurndown->json('data');
        $this->assertNotEmpty($data);
        $this->assertEquals('2026-06-01', $data[0]['date']);
        $this->assertEquals(1, $data[0]['ideal_tasks']);
        $this->assertEquals(8, $data[0]['ideal_hours']);
    }
}
