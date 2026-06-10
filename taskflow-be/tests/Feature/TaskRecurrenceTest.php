<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Carbon\Carbon;
use Illuminate\Support\Facades\Event;
use App\Events\TaskUpdated;

class TaskRecurrenceTest extends TestCase
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
            'title' => 'Daily Report Template',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->admin->id,
            'assignee_id' => $this->employee->id,
            'position' => 1,
        ]);
    }

    public function test_next_trigger_date_calculation(): void
    {
        // 1. Daily Recurrence
        $this->task->update([
            'is_recurring' => true,
            'recurring_frequency' => 'daily',
            'recurring_interval' => 2,
        ]);

        $startDate = Carbon::create(2026, 6, 1, 9, 0, 0); // Monday
        $next = $this->task->calculateNextTriggerDate($startDate);
        $this->assertEquals('2026-06-03 09:00:00', $next->toDateTimeString());

        // 2. Weekly Recurrence (e.g. Wednesday and Friday)
        $this->task->update([
            'is_recurring' => true,
            'recurring_frequency' => 'weekly',
            'recurring_interval' => 1,
            'recurring_weekdays' => [3, 5], // Wed, Fri
        ]);

        // If starting from Monday (day 1), next is Wednesday (day 3)
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 1, 9, 0, 0)); // Mon
        $this->assertEquals('2026-06-03 09:00:00', $next->toDateTimeString());

        // If starting from Wednesday (day 3), next is Friday (day 5)
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 3, 9, 0, 0)); // Wed
        $this->assertEquals('2026-06-05 09:00:00', $next->toDateTimeString());

        // If starting from Saturday (day 6), next is next Wednesday (day 3) of next week
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 6, 9, 0, 0)); // Sat
        $this->assertEquals('2026-06-10 09:00:00', $next->toDateTimeString());

        // 3. Monthly Recurrence
        $this->task->update([
            'is_recurring' => true,
            'recurring_frequency' => 'monthly',
            'recurring_interval' => 1,
            'recurring_monthday' => 15,
        ]);

        // If starting from June 1st, next is June 15th
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 1, 9, 0, 0));
        $this->assertEquals('2026-06-15 09:00:00', $next->toDateTimeString());

        // If starting from June 20th, next is July 15th
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 20, 9, 0, 0));
        $this->assertEquals('2026-07-15 09:00:00', $next->toDateTimeString());

        // Cap date to month length (e.g. Feb 30th -> Feb 28th)
        $this->task->update([
            'recurring_monthday' => 31,
        ]);
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 1, 31, 9, 0, 0));
        $this->assertEquals('2026-02-28 09:00:00', $next->toDateTimeString());
    }

    public function test_next_trigger_date_calculation_with_custom_time(): void
    {
        // 1. Daily Recurrence, today target is in the future
        $this->task->update([
            'is_recurring' => true,
            'recurring_frequency' => 'daily',
            'recurring_interval' => 1,
            'recurring_time' => '15:30',
        ]);
        // From 14:15, next should be today at 15:30
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 5, 14, 15, 0));
        $this->assertEquals('2026-06-05 15:30:00', $next->toDateTimeString());

        // From 16:00, next should be tomorrow at 15:30
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 5, 16, 0, 0));
        $this->assertEquals('2026-06-06 15:30:00', $next->toDateTimeString());

        // 2. Weekly Recurrence, today (Monday) target in the future
        $this->task->update([
            'recurring_frequency' => 'weekly',
            'recurring_interval' => 1,
            'recurring_weekdays' => [1, 3], // Mon, Wed
            'recurring_time' => '10:00',
        ]);
        // From Mon 09:00, next should be Mon 10:00
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 1, 9, 0, 0)); // Mon
        $this->assertEquals('2026-06-01 10:00:00', $next->toDateTimeString());

        // From Mon 11:00, next should be Wed 10:00
        $next = $this->task->calculateNextTriggerDate(Carbon::create(2026, 6, 1, 11, 0, 0)); // Mon
        $this->assertEquals('2026-06-03 10:00:00', $next->toDateTimeString());
    }

    public function test_task_creation_with_recurrence_sets_trigger(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 5, 10, 0, 0));

        $response = $this->actingAs($this->employee)
            ->postJson('/api/tasks', [
                'project_id' => $this->project->id,
                'title' => 'New Recurring Task Template',
                'is_recurring' => true,
                'recurring_frequency' => 'daily',
                'recurring_interval' => 1,
            ]);

        $response->assertStatus(200);
        $taskId = $response->json('data.id');
        
        $task = Task::find($taskId);
        $this->assertTrue($task->is_recurring);
        $this->assertNotNull($task->recurring_next_trigger);
        $this->assertEquals(
            now()->addDay()->format('Y-m-d'),
            $task->recurring_next_trigger->format('Y-m-d')
        );

        Carbon::setTestNow();
    }

    public function test_task_update_recurrence_config(): void
    {
        // Turn on recurrence
        $response = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->task->id}", [
                'is_recurring' => true,
                'recurring_frequency' => 'monthly',
                'recurring_interval' => 2,
                'recurring_monthday' => 10,
            ]);

        $response->assertStatus(200);
        $this->task->refresh();
        $this->assertTrue($this->task->is_recurring);
        $this->assertNotNull($this->task->recurring_next_trigger);

        // Turn off recurrence
        $response = $this->actingAs($this->employee)
            ->putJson("/api/tasks/{$this->task->id}", [
                'is_recurring' => false,
            ]);

        $response->assertStatus(200);
        $this->task->refresh();
        $this->assertFalse($this->task->is_recurring);
        $this->assertNull($this->task->recurring_next_trigger);
    }

    public function test_artisan_command_triggers_and_clones(): void
    {
        Event::fake([TaskUpdated::class]);

        $triggerTime = Carbon::create(2026, 6, 5, 9, 0, 0);
        Carbon::setTestNow($triggerTime);

        // Set up parent task
        $this->task->update([
            'is_recurring' => true,
            'recurring_frequency' => 'monthly',
            'recurring_interval' => 1,
            'recurring_monthday' => 5,
            'recurring_next_trigger' => $triggerTime,
        ]);

        // Run Artisan command
        $this->artisan('tasks:process-recurring')->assertSuccessful();

        // Check task is cloned with date suffix
        $expectedTitle = $this->task->title . ' - Tháng 06/2026';
        $this->assertDatabaseHas('tasks', [
            'project_id' => $this->project->id,
            'title' => $expectedTitle,
            'is_recurring' => false,
            'recurring_frequency' => null,
        ]);

        // Check parent task next trigger date updated to next month
        $this->task->refresh();
        $this->assertEquals('2026-07-05 09:00:00', $this->task->recurring_next_trigger->toDateTimeString());

        // Check task dependency: cloned task (clones) parent task
        $clonedTask = Task::where('title', $expectedTitle)->first();
        $this->assertNotNull($clonedTask);
        $this->assertDatabaseHas('task_dependencies', [
            'task_id' => $clonedTask->id,
            'target_task_id' => $this->task->id,
            'type' => 'clones',
        ]);

        // Check activity logged
        $this->assertDatabaseHas('task_activities', [
            'task_id' => $this->task->id,
            'action' => 'linked_task',
        ]);

        // Check broadcast event triggered
        Event::assertDispatched(TaskUpdated::class);

        Carbon::setTestNow(); // Reset test time
    }
}
