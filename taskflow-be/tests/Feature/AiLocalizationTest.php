<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiLocalizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Project $project;
    protected Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a user
        $this->user = User::create([
            'id' => 1,
            'bitrix_id' => 12345,
            'name' => 'Admin User',
            'email' => 'admin@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'admin',
        ]);

        // Create a project
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

        // Create a task
        $this->task = Task::create([
            'project_id' => $this->project->id,
            'title' => 'Test Task Title',
            'status' => 'todo',
            'priority' => 'medium',
            'creator_id' => $this->user->id,
            'position' => 1
        ]);
    }

    /**
     * Test global chat mock responses in English when X-Language header is set to 'en'.
     */
    public function test_global_chat_mock_response_in_english(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'hello']
                ]
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        
        // Should contain English notice text
        $reply = $response->json('reply');
        $this->assertStringContainsString('Notice', $reply);
        $this->assertStringContainsString('Smart Mock Mode', $reply);
        $this->assertStringContainsString('Hello! I am your global AI assistant', $reply);
    }

    /**
     * Test global chat mock responses in Vietnamese when X-Language header is set to 'vi' or not provided.
     */
    public function test_global_chat_mock_response_in_vietnamese(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'xin chào']
                ]
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);

        // Should contain Vietnamese notice text
        $reply = $response->json('reply');
        $this->assertStringContainsString('Lưu ý', $reply);
        $this->assertStringContainsString('chế độ mô phỏng thông minh', $reply);
        $this->assertStringContainsString('Xin chào! Tôi là Trợ lý AI toàn cầu', $reply);
    }

    /**
     * Test global chat command simulation in English.
     */
    public function test_global_chat_command_simulation_in_english(): void
    {
        // 1. Create project command in English
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'create project "Mock Project EN"']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('I have successfully created the project', $reply);
        $this->assertStringContainsString('Mock Project EN', $reply);

        // Verify project created in DB
        $this->assertDatabaseHas('projects', [
            'name' => 'Mock Project EN',
            'created_by' => $this->user->id
        ]);

        // 2. Start timer command in English
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'start timer for task ' . $this->task->id]
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('I have activated the real-time work timer', $reply);

        // Verify active time entry exists in DB
        $this->assertDatabaseHas('time_entries', [
            'task_id' => $this->task->id,
            'user_id' => $this->user->id,
            'ended_at' => null
        ]);
    }

    /**
     * Test global chat command simulation in Vietnamese.
     */
    public function test_global_chat_command_simulation_in_vietnamese(): void
    {
        // 1. Create project command in Vietnamese
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo dự án "Mock Project VI"']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Mình đã tạo thành công dự án thực tế', $reply);
        $this->assertStringContainsString('Mock Project VI', $reply);

        // Verify project created in DB
        $this->assertDatabaseHas('projects', [
            'name' => 'Mock Project VI',
            'created_by' => $this->user->id
        ]);
    }

    /**
     * Test checklist generator title in English.
     */
    public function test_checklist_generation_title_in_english(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson("/api/tasks/{$this->task->id}/ai/checklist");

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);

        // Verify checklist created with English title
        $this->assertDatabaseHas('checklists', [
            'task_id' => $this->task->id,
            'name' => '✨ AI Suggested Checklist'
        ]);

        // Verify checklist items exist
        $checklist = \App\Models\Checklist::where('task_id', $this->task->id)
            ->where('name', '✨ AI Suggested Checklist')
            ->first();
        $this->assertNotNull($checklist);
        $this->assertGreaterThan(0, $checklist->items()->count());

        // The first item should be translated to English
        $this->assertDatabaseHas('checklist_items', [
            'checklist_id' => $checklist->id,
            'name' => 'Analyze requirement description for: Test Task Title'
        ]);
    }

    /**
     * Test checklist generator title in Vietnamese.
     */
    public function test_checklist_generation_title_in_vietnamese(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson("/api/tasks/{$this->task->id}/ai/checklist");

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);

        // Verify checklist created with Vietnamese title
        $this->assertDatabaseHas('checklists', [
            'task_id' => $this->task->id,
            'name' => '✨ Checklist gợi ý từ AI'
        ]);

        $checklist = \App\Models\Checklist::where('task_id', $this->task->id)
            ->where('name', '✨ Checklist gợi ý từ AI')
            ->first();
        $this->assertNotNull($checklist);

        // The first item should be translated to Vietnamese
        $this->assertDatabaseHas('checklist_items', [
            'checklist_id' => $checklist->id,
            'name' => 'Phân tích yêu cầu công việc cho: Test Task Title'
        ]);
    }

    /**
     * Test project creation clarification when name is missing in Vietnamese.
     */
    public function test_missing_params_clarification_project_vi(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo dự án']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Để tạo dự án, vui lòng cung cấp tên dự án nằm trong dấu nháy kép', $reply);
    }

    /**
     * Test project creation clarification when name is missing in English.
     */
    public function test_missing_params_clarification_project_en(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'create project']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('To create a project, please provide a project name enclosed in quotes', $reply);
    }

    /**
     * Test task creation clarification when title and project are missing in Vietnamese.
     */
    public function test_missing_params_clarification_task_no_project_vi(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo task']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Để tạo công việc mới, vui lòng cung cấp tiêu đề công việc trong dấu nháy kép và chỉ định dự án', $reply);
    }

    /**
     * Test task creation clarification when title and project are missing in English.
     */
    public function test_missing_params_clarification_task_no_project_en(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'create task']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('To create a task, please provide a task title in quotes and specify the project ID', $reply);
    }

    /**
     * Test task creation clarification when project is specified but title is missing in Vietnamese.
     */
    public function test_missing_params_clarification_task_with_project_vi(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo task trong dự án 1']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Để tạo công việc trong dự án ID **1**, vui lòng cung cấp tiêu đề công việc nằm trong dấu nháy kép', $reply);
    }

    /**
     * Test task creation clarification when project is specified but title is missing in English.
     */
    public function test_missing_params_clarification_task_with_project_en(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'create task in project 1']
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('To create a task in project ID **1**, please provide a task title enclosed in quotes', $reply);
    }

    /**
     * Test custom task creation successfully in Vietnamese.
     */
    public function test_custom_task_creation_successful_vi(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'vi')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo task "Custom Task VI" trong dự án ' . $this->project->id]
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('Mình đã tạo thành công công việc **"Custom Task VI"** (ID:', $reply);
        $this->assertStringContainsString($this->project->name, $reply);

        $this->assertDatabaseHas('tasks', [
            'project_id' => $this->project->id,
            'title' => 'Custom Task VI'
        ]);
    }

    /**
     * Test custom task creation successfully in English.
     */
    public function test_custom_task_creation_successful_en(): void
    {
        $response = $this->actingAs($this->user)
            ->withHeader('X-Language', 'en')
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'create task "Custom Task EN" in project ' . $this->project->id]
                ]
            ]);

        $response->assertStatus(200);
        $reply = $response->json('reply');
        $this->assertStringContainsString('I have successfully created task **"Custom Task EN"** (ID:', $reply);
        $this->assertStringContainsString($this->project->name, $reply);

        $this->assertDatabaseHas('tasks', [
            'project_id' => $this->project->id,
            'title' => 'Custom Task EN'
        ]);
    }

    /**
     * Test execution of real text-based function calls from response content.
     */
    public function test_global_chat_text_based_tool_calling_execution(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-groq-key';
        
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => \Illuminate\Support\Facades\Http::sequence()
                ->push([
                    'choices' => [
                        [
                            'message' => [
                                'role' => 'assistant',
                                'content' => 'Tôi sẽ giúp bạn tạo dự án mới: (function=create_project>{"name": "Dự án Thực Tế Llama", "description": "Mô tả dự án", "priority": "high"}<function>'
                            ]
                        ]
                    ]
                ], 200)
                ->push([
                    'choices' => [
                        [
                            'message' => [
                                'role' => 'assistant',
                                'content' => 'Đã tạo thành công dự án Thực Tế Llama!'
                            ]
                        ]
                    ]
                ], 200)
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo project']
                ]
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertStringContainsString('Đã tạo thành công dự án Thực Tế Llama!', $response->json('reply'));

        $this->assertDatabaseHas('projects', [
            'name' => 'Dự án Thực Tế Llama',
            'created_by' => $this->user->id
        ]);

        $_ENV['OPENAI_API_KEY'] = '';
    }

    /**
     * Test that placeholder text-based function calls are cleaned up and NOT executed.
     */
    public function test_global_chat_text_based_tool_calling_placeholder_skipped(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-groq-key';
        
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => \Illuminate\Support\Facades\Http::response([
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Vui lòng cung cấp tên dự án. Ví dụ: (function=create_project>{"name": "project_name", "description": ""} Nhập vào "project_name".'
                        ]
                    ]
                ]
            ], 200)
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo project']
                ]
            ]);

        $response->assertStatus(200);
        
        $reply = $response->json('reply');
        $this->assertStringNotContainsString('(function=create_project', $reply);
        $this->assertStringContainsString('Vui lòng cung cấp tên dự án. Ví dụ:  Nhập vào "project_name".', $reply);

        $this->assertDatabaseMissing('projects', [
            'name' => 'project_name'
        ]);

        $_ENV['OPENAI_API_KEY'] = '';
    }

    /**
     * Test that empty function tags are cleaned and replaced with friendly names.
     */
    public function test_global_chat_friendly_tag_cleanup(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-groq-key';
        
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => \Illuminate\Support\Facades\Http::response([
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => 'Bạn có thể gọi hàm <function=list_projects></function> hoặc dùng <function=list_tasks>.'
                        ]
                    ]
                ]
            ], 200)
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'xem danh sách']
                ]
            ]);

        $response->assertStatus(200);
        
        $reply = $response->json('reply');
        $this->assertStringNotContainsString('<function=', $reply);
        $this->assertStringContainsString('Bạn có thể gọi hàm "Xem danh sách dự án" hoặc dùng "Xem danh sách công việc".', $reply);

        $_ENV['OPENAI_API_KEY'] = '';
    }

    /**
     * Test that function tags in history are completely stripped before sending to OpenAI.
     */
    public function test_global_chat_history_tag_stripping(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-groq-key';
        
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => function (\Illuminate\Http\Client\Request $request) {
                $messages = $request->data()['messages'];
                // Find assistant message and check if it was cleaned
                $cleaned = false;
                foreach ($messages as $msg) {
                    if ($msg['role'] === 'assistant' && strpos($msg['content'], '(function=') === false) {
                        $cleaned = true;
                    }
                }
                return \Illuminate\Support\Facades\Http::response([
                    'choices' => [
                        [
                            'message' => [
                                'role' => 'assistant',
                                'content' => $cleaned ? 'History cleaned!' : 'History dirty!'
                            ]
                        ]
                    ]
                ], 200);
            }
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'tạo project mới'],
                    ['role' => 'ai', 'content' => 'Vui lòng cho biết tên. (function=create_project>{"name": "project_name"}<function>'],
                    ['role' => 'user', 'content' => 'Tên là Dự án AAA']
                ]
            ]);

        $response->assertStatus(200);
        $this->assertEquals('History cleaned!', $response->json('reply'));

        $_ENV['OPENAI_API_KEY'] = '';
    }

    /**
     * Test that assistant content is accumulated across iterations and not overwritten by subsequent empty messages.
     */
    public function test_global_chat_accumulates_content_during_iterations(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-groq-key';
        
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => \Illuminate\Support\Facades\Http::sequence([
                // Iteration 0
                \Illuminate\Support\Facades\Http::response([
                    'choices' => [
                        [
                            'message' => [
                                'role' => 'assistant',
                                'content' => 'Task created successfully!',
                                'tool_calls' => [
                                    [
                                        'id' => 'call_sf_1',
                                        'type' => 'function',
                                        'function' => [
                                            'name' => 'suggest_follow_ups',
                                            'arguments' => json_encode([
                                                'suggestions' => ['Do X', 'Do Y']
                                            ])
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ], 200),
                // Iteration 1
                \Illuminate\Support\Facades\Http::response([
                    'choices' => [
                        [
                            'message' => [
                                'role' => 'assistant'
                            ]
                        ]
                    ]
                ], 200)
            ])
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/api/ai/global/chat', [
                'messages' => [
                    ['role' => 'user', 'content' => 'Tạo task leo rank']
                ]
            ]);

        $response->assertStatus(200);
        $this->assertEquals('Task created successfully!', $response->json('reply'));
        $this->assertEquals(['Do X', 'Do Y'], $response->json('actions'));

        $_ENV['OPENAI_API_KEY'] = '';
    }

    /**
     * Test enforcement of assignee project membership on create_task/update_task and project filtering in list_users.
     */
    public function test_assignee_project_membership_enforcement(): void
    {
        $service = app(\App\Services\OpenAiService::class);
        $method = new \ReflectionMethod(\App\Services\OpenAiService::class, 'executeTool');
        $method->setAccessible(true);

        // Create another user who is NOT a member of the project
        $nonMember = User::create([
            'id' => 999,
            'bitrix_id' => 99999,
            'name' => 'Non Member User',
            'email' => 'nonmember@taskflow.local',
            'password' => \Illuminate\Support\Facades\Hash::make('password'),
            'role' => 'employee',
        ]);

        // 1. Test create_task with non-member assignee
        $result = $method->invoke($service, 'create_task', [
            'project_id' => $this->project->id,
            'title' => 'New AI Task',
            'assignee_id' => $nonMember->id
        ], $this->user, 'vi');

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('không phải là thành viên của dự án', $result['message']);

        // 2. Test update_task with non-member assignee
        $resultUpdate = $method->invoke($service, 'update_task', [
            'task_id' => $this->task->id,
            'assignee_id' => $nonMember->id
        ], $this->user, 'vi');

        $this->assertFalse($resultUpdate['success']);
        $this->assertStringContainsString('không phải là thành viên của dự án', $resultUpdate['message']);

        // 3. Test list_users with project filtering
        // Let's add $this->user as a project member first
        $this->project->members()->attach($this->user->id, ['role' => 'manager']);

        // Now list_users filtered by project should only return members of the project
        $resultList = $method->invoke($service, 'list_users', [
            'project_id' => $this->project->id
        ], $this->user, 'vi');

        $this->assertTrue($resultList['success']);
        $usersList = $resultList['users'];
        
        // Non-member should not be in the list
        $nonMemberInList = false;
        $memberInList = false;
        foreach ($usersList as $u) {
            if ($u['id'] == $nonMember->id) $nonMemberInList = true;
            if ($u['id'] == $this->user->id) $memberInList = true;
        }

        $this->assertTrue($memberInList);
        $this->assertFalse($nonMemberInList);
    }

    /**
     * Test model fallback behavior when multiple models are configured and the primary model fails.
     */
    public function test_model_fallback_sequential_retry(): void
    {
        $_ENV['OPENAI_API_KEY'] = 'fake-key';
        
        $service = new class extends \App\Services\OpenAiService {
            public function __construct() {
                $this->apiKey = 'fake-key';
                $this->models = ['model-fail-1', 'model-fail-2', 'model-success'];
                $this->model = 'model-fail-1';
                $this->baseUrl = 'https://api.openai.com/v1';
            }
            
            public function publicPostChatCompletion(array $payload) {
                return $this->postChatCompletion($payload);
            }
            
            public function getActiveModel() {
                return $this->model;
            }
        };

        $requestedModels = [];
        \Illuminate\Support\Facades\Http::fake([
            '*chat/completions*' => function (\Illuminate\Http\Client\Request $request) use (&$requestedModels) {
                $body = json_decode($request->body(), true);
                $model = $body['model'] ?? null;
                $requestedModels[] = $model;
                
                if ($model === 'model-fail-1') {
                    return \Illuminate\Support\Facades\Http::response(['error' => 'Rate limit exceeded'], 429);
                }
                if ($model === 'model-fail-2') {
                    return \Illuminate\Support\Facades\Http::response(['error' => 'Internal server error'], 500);
                }
                if ($model === 'model-success') {
                    return \Illuminate\Support\Facades\Http::response([
                        'choices' => [
                            [
                                'message' => [
                                    'role' => 'assistant',
                                    'content' => 'Hello from model-success!'
                                ]
                            ]
                        ]
                    ], 200);
                }
                return \Illuminate\Support\Facades\Http::response(['error' => 'Unknown model'], 400);
            }
        ]);

        $response = $service->publicPostChatCompletion([
            'messages' => [['role' => 'user', 'content' => 'hi']]
        ]);

        $this->assertEquals(200, $response->status());
        $this->assertEquals('Hello from model-success!', $response->json('choices.0.message.content'));
        
        $this->assertEquals(['model-fail-1', 'model-fail-2', 'model-success'], $requestedModels);
        $this->assertEquals('model-success', $service->getActiveModel());

        $_ENV['OPENAI_API_KEY'] = '';
    }
}


