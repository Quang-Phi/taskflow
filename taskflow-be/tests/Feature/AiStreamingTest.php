<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiStreamingTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Project $project;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'id' => 1,
            'bitrix_id' => 12345,
            'name' => 'Admin User',
            'email' => 'admin@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'admin',
        ]);

        $this->project = Project::create([
            'name' => 'Test Project',
            'description' => 'Test Description',
            'created_by' => $this->user->id,
            'status' => 'active',
            'priority' => 'medium',
            'statuses' => [
                ['id' => 'todo', 'name' => 'To Do', 'type' => 'open'],
                ['id' => 'done', 'name' => 'Done', 'type' => 'closed']
            ]
        ]);

        $this->task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Test Task Title',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->user->id,
            'assignee_id' => $this->user->id,
            'position' => 1
        ]);
    }

    /**
     * Test streaming task chat.
     */
    public function test_streaming_task_chat(): void
    {
        // Mock X-Language as vi (calls mock stream response if API key config is empty)
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->post('/api/tasks/' . $this->task->id . '/ai/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'hello']
                ],
                'stream' => true
            ]);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/event-stream; charset=UTF-8');
        
        $content = $response->streamedContent();
        $this->assertStringContainsString('data: {"content"', $content);
    }

    /**
     * Test streaming global chat.
     */
    public function test_streaming_global_chat(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->post('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'xin chào']
                ],
                'stream' => true
            ]);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/event-stream; charset=UTF-8');
        
        $content = $response->streamedContent();
        $this->assertStringContainsString('data: {"content"', $content);
    }
}
