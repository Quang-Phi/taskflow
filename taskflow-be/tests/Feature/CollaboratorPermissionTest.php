<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Services\BitrixService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Mockery\MockInterface;

class CollaboratorPermissionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $manager;
    protected User $employeeInDept10;
    protected User $employeeInDept20;

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
            'name' => 'Department Manager',
            'email' => 'manager@taskflow.local',
            'role' => 'manager',
            'active' => true,
            'department_ids' => [10],
        ]);

        $this->employeeInDept10 = User::create([
            'id' => 3,
            'bitrix_id' => 10003,
            'name' => 'Employee Dept 10',
            'email' => 'emp10@taskflow.local',
            'role' => 'employee',
            'active' => true,
            'department_ids' => [10],
        ]);

        $this->employeeInDept20 = User::create([
            'id' => 4,
            'bitrix_id' => 10004,
            'name' => 'Employee Dept 20 (Outside)',
            'email' => 'emp20@taskflow.local',
            'role' => 'employee',
            'active' => true,
            'department_ids' => [20],
        ]);

        // Mock BitrixService department fetch and token validation
        $this->mock(BitrixService::class, function (MockInterface $mock) {
            $mock->shouldReceive('ensureValidToken')->andReturn('mocked_token');
            $mock->shouldReceive('getDepartments')->andReturn([
                ['ID' => 10, 'UF_HEAD' => 2, 'PARENT' => null],
                ['ID' => 20, 'UF_HEAD' => null, 'PARENT' => null],
            ]);
        });
    }

    public function test_manager_can_create_project_with_outside_users_as_collaborators(): void
    {
        $response = $this->actingAs($this->manager)
            ->postJson('/api/projects', [
                'name' => 'Manager Collaborative Project',
                'member_ids' => [
                    $this->manager->id,
                    $this->employeeInDept10->id, // Inside department -> member
                    $this->employeeInDept20->id, // Outside department -> collaborator
                ],
            ]);

        $response->assertStatus(210);
        $response->assertJsonPath('success', true);

        // Verify that employeeInDept10 got 'member' role
        $this->assertDatabaseHas('project_members', [
            'project_id' => $response->json('data.id'),
            'user_id' => $this->employeeInDept10->id,
            'role' => 'member',
        ]);

        // Verify that employeeInDept20 got 'collaborator' role
        $this->assertDatabaseHas('project_members', [
            'project_id' => $response->json('data.id'),
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
        ]);
    }

    public function test_manager_can_add_outside_users_only_as_collaborators(): void
    {
        $project = Project::create([
            'name' => 'Existing Manager Project',
            'created_by' => $this->manager->id,
            'status' => 'active',
            'priority' => 'medium',
        ]);

        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->manager->id,
            'role' => 'manager',
            'joined_at' => now(),
        ]);

        // 1. Trying to add outside user as 'member' should automatically override to 'collaborator' and succeed (200)
        $response = $this->actingAs($this->manager)
            ->postJson("/api/projects/{$project->id}/members", [
                'user_ids' => [$this->employeeInDept20->id],
                'role' => 'member',
            ]);
        $response->assertStatus(200);

        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
        ]);
    }

    public function test_collaborator_task_scoping_in_project_view_and_index(): void
    {
        $project = Project::create([
            'name' => 'Collaborator Scoping Project',
            'created_by' => $this->manager->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'open'],
            ]
        ]);

        // Add manager
        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->manager->id,
            'role' => 'manager',
            'joined_at' => now(),
        ]);

        // Add employee20 as collaborator
        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
            'joined_at' => now(),
        ]);

        // Add employee10 as normal member
        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept10->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        // Create tasks
        $task1 = Task::create([
            'project_id' => $project->id,
            'title' => 'Task Assigned to Collaborator',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->manager->id,
            'assignee_id' => $this->employeeInDept20->id,
            'position' => 1,
        ]);

        $task2 = Task::create([
            'project_id' => $project->id,
            'title' => 'Task Assigned to Employee10',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->manager->id,
            'assignee_id' => $this->employeeInDept10->id,
            'position' => 2,
        ]);

        // 1. Collaborator calls GET /api/projects/{id}
        // Should ONLY see task1 (assigned to them) and not task2
        $responseProjectView = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/projects/{$project->id}");
        
        $responseProjectView->assertStatus(200);
        $tasksInProject = $responseProjectView->json('data.tasks');
        $this->assertCount(1, $tasksInProject);
        $this->assertEquals($task1->id, $tasksInProject[0]['id']);

        // 2. Collaborator calls GET /api/tasks?project_id={id}
        // Should ONLY see task1
        $responseTasksList = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/tasks?project_id={$project->id}");

        $responseTasksList->assertStatus(200);
        $tasksInList = $responseTasksList->json('data');
        // Filter out any global mock tasks if applicable
        $filteredList = array_values(array_filter($tasksInList, fn($t) => $t['project_id'] == $project->id));
        $this->assertCount(1, $filteredList);
        $this->assertEquals($task1->id, $filteredList[0]['id']);

        // 3. Collaborator calls GET /api/tasks/{task2->id}
        // Should be forbidden (403)
        $responseShowForbidden = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/tasks/{$task2->id}");
        $responseShowForbidden->assertStatus(403);

        // 4. Collaborator calls GET /api/tasks/{task1->id}
        // Should succeed (200)
        $responseShowAllowed = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/tasks/{$task1->id}");
        $responseShowAllowed->assertStatus(200);
    }

    public function test_collaborator_can_view_subtask_of_owned_parent_task(): void
    {
        $project = Project::create([
            'name' => 'Subtask Scoping Project',
            'created_by' => $this->manager->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'open'],
            ]
        ]);

        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->manager->id,
            'role' => 'manager',
            'joined_at' => now(),
        ]);

        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
            'joined_at' => now(),
        ]);

        // Parent task Z (assigned to collaborator employeeInDept20)
        $parentTask = Task::create([
            'project_id' => $project->id,
            'title' => 'Parent Task Z',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->manager->id,
            'assignee_id' => $this->employeeInDept20->id,
            'position' => 1,
        ]);

        // Subtask N (assigned to normal employeeInDept10, child of Z)
        $subtask = Task::create([
            'project_id' => $project->id,
            'title' => 'Subtask N',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->manager->id,
            'assignee_id' => $this->employeeInDept10->id,
            'parent_task_id' => $parentTask->id,
            'position' => 2,
        ]);

        // 1. Collaborator calls GET /api/tasks/{subtask->id}
        // Should succeed (200) because collaborator owns the parent task Z
        $responseShowSubtask = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/tasks/{$subtask->id}");
        $responseShowSubtask->assertStatus(200);

        // 2. Collaborator calls GET /api/projects/{project->id}
        // Should see both parentTask and subtask
        $responseProjectView = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/projects/{$project->id}");
        $responseProjectView->assertStatus(200);
        $tasksInProject = $responseProjectView->json('data.tasks');
        $taskIds = array_column($tasksInProject, 'id');
        $this->assertContains($parentTask->id, $taskIds);
        $this->assertContains($subtask->id, $taskIds);

        // 3. Collaborator calls GET /api/tasks?project_id={project->id}&include_subtasks=true
        // Should see both parentTask and subtask
        $responseTasksList = $this->actingAs($this->employeeInDept20)
            ->getJson("/api/tasks?project_id={$project->id}&include_subtasks=true");
        $responseTasksList->assertStatus(200);
        $tasksInList = $responseTasksList->json('data');
        $taskIdsList = array_column($tasksInList, 'id');
        $this->assertContains($parentTask->id, $taskIdsList);
        $this->assertContains($subtask->id, $taskIdsList);
    }

    public function test_manager_user_listing_scope_restrictions(): void
    {
        // 1. By default, manager can see all users (including outside dept employeeInDept20)
        $responseAll = $this->actingAs($this->manager)
            ->getJson("/api/users");
        
        $responseAll->assertStatus(200);
        $userIdsAll = array_column($responseAll->json('data'), 'id');
        $this->assertContains($this->employeeInDept10->id, $userIdsAll);
        $this->assertContains($this->employeeInDept20->id, $userIdsAll);

        // 2. With scope=managed, manager should ONLY see subordinates (employeeInDept10, themselves)
        $responseManaged = $this->actingAs($this->manager)
            ->getJson("/api/users?scope=managed");

        $responseManaged->assertStatus(200);
        $userIdsManaged = array_column($responseManaged->json('data'), 'id');
        $this->assertContains($this->employeeInDept10->id, $userIdsManaged);
        $this->assertNotContains($this->employeeInDept20->id, $userIdsManaged);
    }
}
