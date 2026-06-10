<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Services\BitrixService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Mockery\MockInterface;

class ProjectMemberConstraintTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superadmin;
    protected User $manager;
    protected User $employeeInDept10;
    protected User $employeeInDept11;
    protected User $employeeInDept12;
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

        $this->superadmin = User::create([
            'id' => 7,
            'bitrix_id' => 10007,
            'name' => 'Super Admin',
            'email' => 'superadmin@taskflow.local',
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

        $this->employeeInDept11 = User::create([
            'id' => 4,
            'bitrix_id' => 10004,
            'name' => 'Employee Dept 11 (Sub)',
            'email' => 'emp11@taskflow.local',
            'role' => 'employee',
            'active' => true,
            'department_ids' => [11],
        ]);

        $this->employeeInDept12 = User::create([
            'id' => 5,
            'bitrix_id' => 10005,
            'name' => 'Employee Dept 12 (Sub-Sub)',
            'email' => 'emp12@taskflow.local',
            'role' => 'employee',
            'active' => true,
            'department_ids' => [12],
        ]);

        $this->employeeInDept20 = User::create([
            'id' => 6,
            'bitrix_id' => 10006,
            'name' => 'Employee Dept 20 (Unrelated)',
            'email' => 'emp20@taskflow.local',
            'role' => 'employee',
            'active' => true,
            'department_ids' => [20],
        ]);

        // Mock BitrixService department fetch
        $this->mock(BitrixService::class, function (MockInterface $mock) {
            $mock->shouldReceive('ensureValidToken')->andReturn('mocked_token');
            $mock->shouldReceive('getDepartments')->andReturn([
                ['ID' => 10, 'UF_HEAD' => 2, 'PARENT' => null],
                ['ID' => 11, 'UF_HEAD' => null, 'PARENT' => 10],
                ['ID' => 12, 'UF_HEAD' => null, 'PARENT' => 11],
                ['ID' => 20, 'UF_HEAD' => null, 'PARENT' => null],
            ]);
        });
    }

    public function test_admin_and_superadmin_can_create_project_with_any_members(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/projects', [
                'name' => 'Admin Project',
                'member_ids' => [2, 3, 4, 5, 6],
            ]);

        $response->assertStatus(210);
        $response->assertJsonPath('success', true);
        
        $response2 = $this->actingAs($this->superadmin)
            ->postJson('/api/projects', [
                'name' => 'Superadmin Project',
                'member_ids' => [1, 2, 3, 4, 5, 6],
            ]);

        $response2->assertStatus(210);
        $response2->assertJsonPath('success', true);
    }

    public function test_employee_can_only_create_project_with_themselves(): void
    {
        // Allowed: creating with only themselves
        $response = $this->actingAs($this->employeeInDept10)
            ->postJson('/api/projects', [
                'name' => 'Employee Self Project',
                'member_ids' => [$this->employeeInDept10->id],
            ]);

        $response->assertStatus(210);
        $response->assertJsonPath('success', true);

        // Forbidden: creating project with others
        $responseForbidden = $this->actingAs($this->employeeInDept10)
            ->postJson('/api/projects', [
                'name' => 'Employee Forbidden Project',
                'member_ids' => [$this->employeeInDept10->id, $this->employeeInDept11->id],
            ]);

        $responseForbidden->assertStatus(403);
        $responseForbidden->assertJsonPath('success', false);
    }

    public function test_manager_can_create_project_with_dept_members_and_subdept_members(): void
    {
        // Allowed: manager, employees in dept 10, dept 11, and dept 12
        $response = $this->actingAs($this->manager)
            ->postJson('/api/projects', [
                'name' => 'Manager Valid Project',
                'member_ids' => [
                    $this->manager->id,
                    $this->employeeInDept10->id,
                    $this->employeeInDept11->id,
                    $this->employeeInDept12->id,
                ],
            ]);

        $response->assertStatus(210);
        $response->assertJsonPath('success', true);

        // Under the Collaborator role rule, manager CAN add employee in dept 20 as collaborator
        $responseCollaborator = $this->actingAs($this->manager)
            ->postJson('/api/projects', [
                'name' => 'Manager Invalid Project',
                'member_ids' => [
                    $this->manager->id,
                    $this->employeeInDept20->id,
                ],
            ]);

        $responseCollaborator->assertStatus(210);
        $responseCollaborator->assertJsonPath('success', true);

        $this->assertDatabaseHas('project_members', [
            'project_id' => $responseCollaborator->json('data.id'),
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
        ]);
    }

    public function test_add_member_constraints(): void
    {
        // Let's create a project owned by admin
        $project = Project::create([
            'name' => 'Test Project for Add Member',
            'created_by' => $this->admin->id,
            'status' => 'active',
            'priority' => 'medium',
        ]);
        
        // Add manager to the project
        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->manager->id,
            'role' => 'manager',
            'joined_at' => now(),
        ]);

        // Add employee10 to the project
        DB::table('project_members')->insert([
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept10->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        // 1. Admin can add anyone
        $responseAdmin = $this->actingAs($this->admin)
            ->postJson("/api/projects/{$project->id}/members", [
                'user_ids' => [$this->employeeInDept20->id],
            ]);
        $responseAdmin->assertStatus(200);

        // 2. Employee cannot add anyone outside (not even inside, since they are not manager of the project)
        $responseEmp = $this->actingAs($this->employeeInDept10)
            ->postJson("/api/projects/{$project->id}/members", [
                'user_ids' => [$this->employeeInDept11->id],
            ]);
        $responseEmp->assertStatus(403);

        // 3. Manager of the project can add members within their sub-depts
        $responseManagerOk = $this->actingAs($this->manager)
            ->postJson("/api/projects/{$project->id}/members", [
                'user_ids' => [$this->employeeInDept11->id, $this->employeeInDept12->id],
            ]);
        $responseManagerOk->assertStatus(200);

        // 4. Manager adds employee from unrelated department (automatically assigned as collaborator)
        $responseManagerCollaborator = $this->actingAs($this->manager)
            ->postJson("/api/projects/{$project->id}/members", [
                'user_ids' => [$this->employeeInDept20->id],
            ]);
        $responseManagerCollaborator->assertStatus(200);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id,
            'user_id' => $this->employeeInDept20->id,
            'role' => 'collaborator',
        ]);
    }
}
