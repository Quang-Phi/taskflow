<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\Checklist;
use App\Models\ChecklistItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskTemplateTest extends TestCase
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

        // Create Checklist
        $checklist = Checklist::create([
            'task_id' => $this->task->id,
            'name' => 'Deploy Checklist',
            'position' => 1,
        ]);
        ChecklistItem::create([
            'checklist_id' => $checklist->id,
            'name' => 'Step 1: Code Review',
            'is_checked' => true,
            'position' => 1,
        ]);
        ChecklistItem::create([
            'checklist_id' => $checklist->id,
            'name' => 'Step 2: Run Migrations',
            'is_checked' => false,
            'position' => 2,
        ]);

        // Create Subtask
        Task::create([
            'project_id' => $this->project->id,
            'parent_task_id' => $this->task->id,
            'title' => 'Writing Unit Tests',
            'description' => 'Write backend unit tests.',
            'status' => 'todo',
            'priority' => 'medium',
            'type' => 'task',
            'creator_id' => $this->admin->id,
            'position' => 1,
        ]);
    }

    public function test_can_save_task_as_template(): void
    {
        $response = $this->actingAs($this->employee)
            ->postJson('/api/task-templates', [
                'name' => 'Deploy Template',
                'project_id' => $this->project->id,
                'task_id' => $this->task->id,
                'is_public' => true,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.name', 'Deploy Template');

        $templateId = $response->json('data.id');
        $template = TaskTemplate::find($templateId);

        $this->assertNotNull($template);
        $this->assertEquals('Deploy Template', $template->name);
        $this->assertCount(1, $template->checklist_template);
        $this->assertEquals('Deploy Checklist', $template->checklist_template[0]['name']);
        $this->assertCount(2, $template->checklist_template[0]['items']);
        $this->assertCount(1, $template->subtask_template);
        $this->assertEquals('Writing Unit Tests', $template->subtask_template[0]['title']);
    }

    public function test_can_apply_template_on_task_creation(): void
    {
        // Create template first
        $template = TaskTemplate::create([
            'project_id' => $this->project->id,
            'name' => 'Custom Onboarding Template',
            'description' => 'Default onboarding tasks.',
            'type' => 'task',
            'priority' => 'high',
            'checklist_template' => [
                [
                    'name' => 'Setup Checklist',
                    'position' => 1,
                    'items' => [
                        ['name' => 'Install Slack', 'is_checked' => false, 'position' => 1],
                        ['name' => 'Configure SSH', 'is_checked' => false, 'position' => 2],
                    ]
                ]
            ],
            'subtask_template' => [
                [
                    'title' => 'Meet the Team',
                    'description' => 'Introduction call',
                    'priority' => 'medium',
                    'type' => 'task',
                ]
            ],
            'created_by' => $this->admin->id,
            'is_public' => false,
        ]);

        // Create task applying template
        $response = $this->actingAs($this->employee)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'Onboarding John Doe',
                'template_id' => $template->id,
            ]);

        $response->assertStatus(200);
        $taskId = $response->json('data.id');

        $task = Task::find($taskId);
        $this->assertNotNull($task);
        // Should prefill description
        $this->assertEquals('Default onboarding tasks.', $task->description);

        // Should copy checklists
        $checklists = Checklist::where('task_id', $task->id)->with('items')->get();
        $this->assertCount(1, $checklists);
        $this->assertEquals('Setup Checklist', $checklists[0]->name);
        $this->assertCount(2, $checklists[0]->items);

        // Should copy subtasks
        $subtasks = Task::where('parent_task_id', $task->id)->get();
        $this->assertCount(1, $subtasks);
        $this->assertEquals('Meet the Team', $subtasks[0]->title);
    }

    public function test_can_list_and_delete_templates(): void
    {
        $template = TaskTemplate::create([
            'project_id' => $this->project->id,
            'name' => 'Temp Template',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->employee)
            ->getJson("/api/task-templates?project_id={$this->project->id}");

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));

        $response = $this->actingAs($this->employee)
            ->deleteJson("/api/task-templates/{$template->id}");

        $response->assertStatus(200);
        $this->assertNull(TaskTemplate::find($template->id));
    }

    public function test_cannot_save_task_as_template_twice(): void
    {
        // Save first time
        $response1 = $this->actingAs($this->employee)
            ->postJson('/api/task-templates', [
                'name' => 'Deploy Template 1',
                'project_id' => $this->project->id,
                'task_id' => $this->task->id,
            ]);
        $response1->assertStatus(200);

        // Try to save second time
        $response2 = $this->actingAs($this->employee)
            ->postJson('/api/task-templates', [
                'name' => 'Deploy Template 2',
                'project_id' => $this->project->id,
                'task_id' => $this->task->id,
            ]);
        $response2->assertStatus(422);
        $response2->assertJsonPath('success', false);
        $response2->assertJsonPath('message', 'Công việc này đã được lưu thành mẫu trước đó.');
    }
}
