<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\TimeEntry;
use App\Models\TaskComment;
use App\Models\TaskActivity;
use App\Events\TaskUpdated;
use App\Events\TimeTrackingUpdated;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class OpenAiService
{
    protected ?string $apiKey;
    protected string $model;
    protected array $models = [];
    protected string $baseUrl;
    protected array $executedEvents = [];

    public function __construct()
    {
        $this->apiKey = env('OPENAI_API_KEY');
        $modelEnv = env('OPENAI_MODEL', 'gpt-4o-mini');
        $this->models = array_filter(array_map('trim', explode(',', $modelEnv)));
        if (empty($this->models)) {
            $this->models = ['gpt-4o-mini'];
        }
        $this->model = $this->models[0];
        $this->baseUrl = env('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    }

    /**
     * Get the current user language from request headers.
     */
    protected function getLanguage(): string
    {
        if (function_exists('request')) {
            return request()->header('X-Language', 'vi');
        }
        return 'vi';
    }

    /**
     * Get the target language name for a language code.
     */
    protected function getTargetLanguageName(string $lang): string
    {
        return match ($lang) {
            'en' => 'English',
            'ja' => 'Japanese',
            default => 'Vietnamese',
        };
    }

    /**
     * Determine if OpenAI API is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Send a POST request to /chat/completions, trying multiple configured models sequentially if one fails.
     */
    protected function postChatCompletion(array $payload, int $timeout = 30): \Illuminate\Http\Client\Response
    {
        $lastResponse = null;
        
        foreach ($this->models as $index => $model) {
            $payload['model'] = $model;
            
            try {
                $response = Http::timeout($timeout)
                    ->withToken($this->apiKey)
                    ->post(rtrim($this->baseUrl, '/') . '/chat/completions', $payload);
                    
                if ($response->successful()) {
                    $this->model = $model;
                    return $response;
                }
                
                $lastResponse = $response;
                Log::warning("OpenAiService: Model '{$model}' failed with status {$response->status()}", [
                    'body' => $response->body()
                ]);
            } catch (\Exception $e) {
                Log::warning("OpenAiService: Model '{$model}' threw exception: " . $e->getMessage());
            }
        }
        
        if ($lastResponse) {
            return $lastResponse;
        }
        
        throw new \Exception("All configured models failed to execute.");
    }

    /**
     * Get the AI training guide content if available to inject into prompt context.
     */
    protected function getTrainingGuide(): string
    {
        $paths = [
            base_path('../taskflow_ai_training_guide.md'),
            base_path('taskflow_ai_training_guide.md'),
        ];
        foreach ($paths as $path) {
            if (file_exists($path)) {
                try {
                    return file_get_contents($path);
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("OpenAiService: Failed to read training guide from {$path}: " . $e->getMessage());
                }
            }
        }
        return '';
    }

    /**
     * Generate checklist items using OpenAI.
     */
    public function generateChecklist(string $title, ?string $description = '', ?string $additionalPrompt = ''): array
    {
        $lang = $this->getLanguage();
        if (!$this->isConfigured()) {
            return $this->getMockChecklist($title, $lang);
        }

        $targetLang = $this->getTargetLanguageName($lang);
        $exampleFormat = match ($lang) {
            'en' => '{"items": ["Prepare document", "Design UI mockup", "Program backend API"]}',
            'ja' => '{"items": ["資料を準備する", "UIモックアップをデザインする", "バックエンドAPIを開発する"]}',
            default => '{"items": ["Chuẩn bị tài liệu", "Thiết kế giao diện mockup", "Lập trình API backend"]}',
        };

        $systemPrompt = "You are a highly efficient project management assistant. "
            . "Generate a checklist of action items/subtasks for a task titled '{$title}'. "
            . "Task Description: '{$description}'.\n"
            . "Return ONLY a JSON object with a single key 'items' containing an array of strings representing the action items. "
            . "Make them clear, actionable, and specific. Do not include markdown formatting like ```json ... ```. "
            . "Translate to {$targetLang} since the user is using {$targetLang}. "
            . "Example format: {$exampleFormat}";

        $userPrompt = "Please generate 4 to 8 checklist items.";
        if ($additionalPrompt) {
            $userPrompt .= " Additional guidelines: {$additionalPrompt}";
        }

        try {
            $response = $this->postChatCompletion([
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt]
                ],
                'response_format' => ['type' => 'json_object'],
                'temperature' => 0.7,
            ], 20);

            if ($response->successful()) {
                $data = $response->json();
                $content = $data['choices'][0]['message']['content'] ?? '{}';
                $decoded = json_decode($content, true);
                if (isset($decoded['items']) && is_array($decoded['items'])) {
                    return $decoded['items'];
                }
            }

            Log::error('OpenAiService checklist generator failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
        } catch (\Exception $e) {
            Log::error('OpenAiService checklist generator exception', [
                'message' => $e->getMessage()
            ]);
        }

        return $this->getMockChecklist($title, $lang);
    }

    /**
     * Chat about a task with OpenAI, injecting task details context.
     */
    public function chat(array $messages, array $taskDetails): string
    {
        $lang = $this->getLanguage();
        if (!$this->isConfigured()) {
            return match ($lang) {
                'en' => "⚠️ **OpenAI API Key configuration is empty!**\n\nPlease configure the `OPENAI_API_KEY` field in the Laravel backend `.env` file (`taskflow-be/.env`) to start chatting with the AI Assistant.",
                'ja' => "⚠️ **OpenAI APIキーが設定されていません！**\n\nAIアシスタントとチャットを開始するには、Laravelバックエンドの`.env`ファイル（`taskflow-be/.env`）で`OPENAI_API_KEY`フィールドを設定してください。",
                default => "⚠️ **Cấu hình OpenAI API Key trống!**\n\nVui lòng cấu hình trường `OPENAI_API_KEY` trong file `.env` của backend Laravel (`taskflow-be/.env`) để bắt đầu trò chuyện với Trợ lý AI.",
            };
        }

        $commentsText = '';
        if (!empty($taskDetails['comments'])) {
            $commentsText = match ($lang) {
                'en' => "Recent comments/discussions:\n",
                'ja' => "最近のコメント/ディスカッション:\n",
                default => "Bình luận/Thảo luận gần đây:\n",
            };
            foreach ($taskDetails['comments'] as $c) {
                $authorName = $c['user']['name'] ?? match ($lang) { 'en' => 'Anonymous', 'ja' => '匿名', default => 'Ẩn danh' };
                $content = strip_tags($c['content'] ?? '');
                $commentsText .= "- {$authorName}: {$content}\n";
            }
        }

        $taskTitleLabel = match ($lang) { 'en' => 'Task Title', 'ja' => 'タスクタイトル', default => 'Tiêu đề công việc' };
        $descLabel = match ($lang) { 'en' => 'Description', 'ja' => '説明', default => 'Mô tả' };
        $statusLabel = match ($lang) { 'en' => 'Status', 'ja' => 'ステータス', default => 'Trạng thái' };
        $priorityLabel = match ($lang) { 'en' => 'Priority', 'ja' => '優先度', default => 'Mức độ ưu tiên' };
        $assigneeLabel = match ($lang) { 'en' => 'Assignee', 'ja' => '担当者', default => 'Người thực hiện (Assignee)' };
        $projectLabel = match ($lang) { 'en' => 'Project', 'ja' => 'プロジェクト', default => 'Dự án' };
        $noDescLabel = match ($lang) { 'en' => 'No description', 'ja' => '説明なし', default => 'Không có mô tả' };
        $unassignedLabel = match ($lang) { 'en' => 'Unassigned', 'ja' => '未割り当て', default => 'Chưa phân công' };
        $unknownLabel = match ($lang) { 'en' => 'Unknown', 'ja' => '不明', default => 'Không rõ' };

        $systemPrompt = "You are an intelligent project management assistant for TaskFlow. "
            . "You help the user understand, manage, and execute their tasks.\n\n"
            . "Context of the current task:\n"
            . "---------------------------------\n"
            . "{$taskTitleLabel}: {$taskDetails['title']}\n"
            . "{$descLabel}: " . ($taskDetails['description'] ?? $noDescLabel) . "\n"
            . "{$statusLabel}: {$taskDetails['status']}\n"
            . "{$priorityLabel}: {$taskDetails['priority']}\n"
            . "{$assigneeLabel}: " . ($taskDetails['assignee']['name'] ?? $unassignedLabel) . "\n"
            . "{$projectLabel}: " . ($taskDetails['project']['name'] ?? $unknownLabel) . "\n"
            . "{$commentsText}"
            . "---------------------------------\n";

        if ($lang === 'en') {
            $systemPrompt .= "Please reply politely and professionally in English. Use markdown formatting to present clearly (lists, bolding, codeblocks if needed). "
                . "If the user asks you to draft a reply to a comment, write a professional and polite draft.";
        } elseif ($lang === 'ja') {
            $systemPrompt .= "丁寧かつプロフェッショナルに日本語で返答してください。マークダウン形式を使用して分かりやすく提示してください（リスト、太字、必要に応じてコードブロック）。ユーザーがコメントへの返信を依頼した場合は、プロフェッショナルで丁寧な下書きを作成してください。";
        } else {
            $systemPrompt .= "Hãy trả lời một cách lịch sự, chuyên nghiệp bằng tiếng Việt. Sử dụng markdown format để trình bày rõ ràng (list, in đậm, codeblock nếu cần). "
                . "Nếu người dùng nhờ soạn tin nhắn phản hồi bình luận, hãy viết nháp một phản hồi chuyên nghiệp và lịch sự.";
        }

        $guide = $this->getTrainingGuide();
        if ($guide !== '') {
            $systemPrompt .= "\n\nTaskFlow System Guidelines:\n" . $guide . "\n";
        }

        $payloadMessages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        $history = array_slice($messages, -10);
        foreach ($history as $msg) {
            $payloadMessages[] = [
                'role' => $msg['role'] === 'ai' ? 'assistant' : 'user',
                'content' => $msg['content'] ?? ''
            ];
        }

        try {
            $response = $this->postChatCompletion([
                'messages' => $payloadMessages,
                'temperature' => 0.7,
            ], 30);

            if ($response->successful()) {
                $data = $response->json();
                return $data['choices'][0]['message']['content'] ?? match ($lang) {
                    'en' => 'Sorry, I did not receive a response from the AI.',
                    'ja' => '申し訳ございません、AIからの応答を受信できませんでした。',
                    default => 'Xin lỗi, tôi không nhận được phản hồi từ AI.',
                };
            }

            Log::error('OpenAiService chat completion failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            return match ($lang) {
                'en' => "⚠️ An error occurred while connecting to OpenAI API. Please check your key configuration.",
                'ja' => "⚠️ OpenAI APIへの接続中にエラーが発生しました。キーの設定を確認してください。",
                default => "⚠️ Đã xảy ra lỗi khi kết nối tới OpenAI API. Vui lòng kiểm tra lại cấu hình key.",
            };
        } catch (\Exception $e) {
            Log::error('OpenAiService chat completion exception', [
                'message' => $e->getMessage()
            ]);
            return match ($lang) {
                'en' => "⚠️ Cannot connect to OpenAI. Error: " . $e->getMessage(),
                'ja' => "⚠️ OpenAIに接続できません。エラー: " . $e->getMessage(),
                default => "⚠️ Không thể kết nối tới OpenAI. Lỗi: " . $e->getMessage(),
            };
        }
    }

    /**
     * Chat globally with tools supporting task/project creation, comments, timers.
     */
    public function globalChat(array $messages, User $user): array
    {
        @set_time_limit(180);
        $lang = $this->getLanguage();
        $this->executedEvents = [];
        if (!$this->isConfigured()) {
            return $this->handleMockGlobalChat($messages, $user);
        }

        $targetLangText = $this->getTargetLanguageName($lang);
        $exampleSuggestions = match ($lang) {
            'en' => "['Reopen task x', 'Stop timer for task y', 'Add a comment to task z']",
            'ja' => "['タスクxを再開する', 'タスクyのタイマーを停止', 'タスクzにコメントを追加']",
            default => "['Mở lại task x', 'Dừng timer cho task y', 'Thêm bình luận vào task z']",
        };

        // System prompt context
        $systemPrompt = "You are 'Brain' (or Max), a powerful global AI assistant for the TaskFlow project management platform. "
            . "You have FULL privileges to interact with the database on behalf of the current user: '{$user->name}' (ID: {$user->id}).\n\n"
            . "Available Capabilities / Guidelines:\n"
            . "1. You can list, create, and update projects or tasks/subtasks using the tools provided.\n"
            . "2. You can comment on tasks, track time (start/stop timer), list users, find stuck/overdue tasks.\n"
            . "3. Always check details before creating or updating. For example, if the user asks to create a task in 'project 1', call list_projects first to match the name 'project 1' to its exact project ID.\n"
            . "4. If the user asks to assign a task, search the users list using list_users first, passing the correct project_id if known. You MUST only assign tasks or suggest assignments to users who are members of that project.\n"
            . "5. When you modify or query tasks or projects successfully, summarize clearly what you did in {$targetLangText}. Use markdown. Avoid using raw database IDs (like task ID or project ID) in your final response text when referring to tasks or projects; instead, always refer to them by their actual names/titles (e.g., task 'Thiết kế UI' in project 'TaskFlow' instead of task ID 1 in project ID 2).\n"
            . "6. Output a list of follow-up buttons if relevant. To do this, always call the suggest_follow_ups tool to define interactive suggestions (e.g. {$exampleSuggestions}).\n"
            . "7. If the user asks to create a project but does not provide a name/title, DO NOT call create_project with a placeholder/dummy name. Instead, ask the user to provide the project name/title.\n"
            . "8. If the user asks to create a task but does not provide a title or doesn't specify which project it belongs to, DO NOT guess. Ask the user for the task title and/or to specify which project the task should belong to (you can also search for available projects first using list_projects).\n"
            . "9. If the user asks to start/stop a timer but does not specify a task ID or name, ask the user which task they want to run the timer for.\n"
            . "10. DO NOT output raw text-based function tags (such as (function=...<function> or <function=.../function>) in your response. If you want to call a tool, use the native tool calling mechanism. If you do not have enough information to call a tool, just ask the user for the information in plain text without referencing any function names or parameter templates.\n"
            . "11. When listing tasks (such as overdue or stuck tasks), DO NOT just report the task name and the project ID. Always use the project relation to mention the project name clearly (e.g., task 'A' belonging to project 'B') so the user has clear context.";

        $guide = $this->getTrainingGuide();
        if ($guide !== '') {
            $systemPrompt .= "\n\nTaskFlow System Guidelines:\n" . $guide . "\n";
        }

        $payloadMessages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        // Format history
        $history = array_slice($messages, -12);
        foreach ($history as $msg) {
            $cleanedContent = $this->stripAllFunctionTags($msg['content'] ?? '');
            if (isset($msg['tool_calls'])) {
                $payloadMessages[] = [
                    'role' => 'assistant',
                    'content' => $cleanedContent !== '' ? $cleanedContent : null,
                    'tool_calls' => $msg['tool_calls']
                ];
            } else {
                $payloadMessages[] = [
                    'role' => $msg['role'] === 'ai' ? 'assistant' : 'user',
                    'content' => $cleanedContent
                ];
            }
        }

        $tools = $this->getToolsSchema($lang);
        $suggestedFollowUps = [];
        $lastAssistantContent = '';
        $maxIterations = 5;

        for ($iteration = 0; $iteration < $maxIterations; $iteration++) {
            try {
                $response = $this->postChatCompletion([
                    'messages' => $payloadMessages,
                    'tools' => $tools,
                    'tool_choice' => 'auto',
                    'temperature' => 0.5,
                ], 40);

                if (!$response->successful()) {
                    Log::error('OpenAiService global chat failure', [
                        'status' => $response->status(),
                        'body' => $response->body()
                    ]);
                    return [
                        'reply' => match ($lang) {
                            'en' => "⚠️ An error occurred while communicating with OpenAI API. Error code: " . $response->status(),
                            'ja' => "⚠️ OpenAI APIとの通信中にエラーが発生しました。エラーコード: " . $response->status(),
                            default => "⚠️ Đã xảy ra lỗi khi trao đổi với OpenAI API. Mã lỗi: " . $response->status(),
                        },
                        'actions' => []
                    ];
                }

                $data = $response->json();
                Log::info('OpenAiService global chat raw response', [
                    'data' => $data
                ]);
                $messageResult = $data['choices'][0]['message'] ?? null;
                if (!$messageResult) {
                    break;
                }

                $rawContent = $messageResult['content'] ?? '';
                if ($rawContent !== '') {
                    $lastAssistantContent = $rawContent;
                }

                // If LLM wants to execute tool calls
                if (!empty($messageResult['tool_calls'])) {
                    // Add assistant tool calls response to message flow
                    $payloadMessages[] = [
                        'role' => 'assistant',
                        'content' => $messageResult['content'] ?? null,
                        'tool_calls' => $messageResult['tool_calls']
                    ];

                    foreach ($messageResult['tool_calls'] as $toolCall) {
                        $toolId = $toolCall['id'];
                        $toolName = $toolCall['function']['name'];
                        $toolArgs = json_decode($toolCall['function']['arguments'], true) ?: [];

                        // Execute the corresponding local database action
                        if ($toolName === 'suggest_follow_ups') {
                            $suggestedFollowUps = $toolArgs['suggestions'] ?? [];
                            $toolOutput = ['status' => 'success', 'message' => 'Follow ups registered'];
                        } else {
                            $toolOutput = $this->executeTool($toolName, $toolArgs, $user, $lang);
                        }

                        // Append tool result message
                        $payloadMessages[] = [
                            'role' => 'tool',
                            'tool_call_id' => $toolId,
                            'name' => $toolName,
                            'content' => json_encode($toolOutput)
                        ];
                    }

                    // Continue loop to send tool results back to OpenAI
                    continue;
                }

                // Parse and clean up text-based function calls if present
                $content = $messageResult['content'] ?? '';
                $textToolCalls = $this->parseTextToolCalls($content);

                if (!empty($textToolCalls)) {
                    $hasExecutedAny = false;
                    $simulatedToolCalls = [];
                    $toolOutputs = [];

                    foreach ($textToolCalls as $index => $tc) {
                        $toolName = $tc['name'];
                        $toolArgs = $tc['arguments'];
                        $rawTag = $tc['raw'];

                        // Check for placeholders in arguments
                        $isPlaceholder = false;
                        if ($toolName === 'create_project' && isset($toolArgs['name']) && $this->isPlaceholder($toolArgs['name'])) {
                            $isPlaceholder = true;
                        }
                        if ($toolName === 'create_task' && isset($toolArgs['title']) && $this->isPlaceholder($toolArgs['title'])) {
                            $isPlaceholder = true;
                        }

                        // Remove the raw tag from the content to keep it clean
                        $content = str_replace($rawTag, '', $content);

                        if (!$isPlaceholder) {
                            $callId = 'call_sim_' . time() . '_' . $index;
                            $simulatedToolCalls[] = [
                                'id' => $callId,
                                'type' => 'function',
                                'function' => [
                                    'name' => $toolName,
                                    'arguments' => json_encode($toolArgs)
                                ]
                            ];

                            if ($toolName === 'suggest_follow_ups') {
                                $suggestedFollowUps = $toolArgs['suggestions'] ?? [];
                                $toolOutput = ['status' => 'success', 'message' => 'Follow ups registered'];
                            } else {
                                $toolOutput = $this->executeTool($toolName, $toolArgs, $user, $lang);
                            }

                            $toolOutputs[] = [
                                'role' => 'tool',
                                'tool_call_id' => $callId,
                                'name' => $toolName,
                                'content' => json_encode($toolOutput)
                            ];
                            $hasExecutedAny = true;
                        }
                    }

                    // Update the messageResult content after stripping raw tags
                    $messageResult['content'] = $this->cleanRemainingFunctionTags(trim($content), $lang);
                    if ($messageResult['content'] !== '') {
                        $lastAssistantContent = $messageResult['content'];
                    }

                    if ($hasExecutedAny) {
                        // Append assistant message with simulated tool calls
                        $payloadMessages[] = [
                            'role' => 'assistant',
                            'content' => $messageResult['content'],
                            'tool_calls' => $simulatedToolCalls
                        ];

                        // Append tool results
                        foreach ($toolOutputs as $to) {
                            $payloadMessages[] = $to;
                        }

                        // Continue loop to let LLM generate response based on tool execution
                        continue;
                    }
                }

                // If no more tool calls, return final synthesized text
                $finalReply = $this->cleanRemainingFunctionTags($lastAssistantContent, $lang);

                return [
                    'reply' => $finalReply !== '' ? $finalReply : match ($lang) {
                        'en' => 'I did not understand your request.',
                        'ja' => 'リクエストを理解できませんでした。',
                        default => 'Tôi chưa hiểu rõ yêu cầu của bạn.',
                    },
                    'actions' => $suggestedFollowUps,
                    'events' => $this->executedEvents
                ];

            } catch (\Exception $e) {
                Log::error('OpenAiService global chat exception', [
                    'message' => $e->getMessage()
                ]);
                return [
                    'reply' => match ($lang) {
                        'en' => "⚠️ An error occurred during processing: " . $e->getMessage(),
                        'ja' => "⚠️ 処理中にエラーが発生しました: " . $e->getMessage(),
                        default => "⚠️ Có lỗi xảy ra trong quá trình xử lý: " . $e->getMessage(),
                    },
                    'actions' => [],
                    'events' => $this->executedEvents
                ];
            }
        }

        return [
            'reply' => match ($lang) {
                'en' => "Sorry, the system was interrupted due to reaching the consecutive processing limit.",
                'ja' => "申し訳ございません、連続処理の上限に達したため、システムが中断されました。",
                default => "Xin lỗi, hệ thống bị gián đoạn do đạt giới hạn xử lý liên tiếp.",
            },
            'actions' => [],
            'events' => $this->executedEvents
        ];
    }

    /**
     * Schema definitions of tools for OpenAI Chat Completions.
     */
    protected function getToolsSchema(string $lang = 'vi'): array
    {
        $isEn = ($lang !== 'vi'); // Both en and ja use English tool descriptions
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'list_projects',
                    'description' => $isEn ? 'Get a list of all projects in the system to find their ID or project details.' : 'Lấy danh sách tất cả các dự án trong hệ thống để tìm ID hoặc thông tin dự án.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => (object)[]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'create_project',
                    'description' => $isEn ? 'Create a new project.' : 'Tạo một dự án mới.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'name' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Name of the project to create' : 'Tên của dự án cần tạo'
                            ],
                            'description' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Detailed description of the project' : 'Mô tả chi tiết dự án'
                            ],
                            'priority' => [
                                'type' => 'string',
                                'enum' => ['low', 'medium', 'high'],
                                'description' => $isEn ? 'Priority of the project' : 'Mức độ ưu tiên của dự án'
                            ],
                            'color' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Hex color code for the project (e.g. #6366f1)' : 'Mã màu Hex cho dự án (Ví dụ: #6366f1)'
                            ]
                        ],
                        'required' => ['name']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'list_tasks',
                    'description' => $isEn ? 'Search or filter tasks by project, assignee, status, or priority.' : 'Tìm kiếm hoặc lọc danh sách các công việc theo dự án, người nhận, trạng thái hoặc độ ưu tiên.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'project_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Filter by project ID' : 'Lọc theo ID dự án'
                            ],
                            'assignee_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Filter by assignee ID' : 'Lọc theo ID người thực hiện'
                            ],
                            'status' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Filter by task status (e.g. todo, in_progress, review, done)' : 'Lọc theo trạng thái công việc (Ví dụ: todo, in_progress, review, done)'
                            ],
                            'priority' => [
                                'type' => 'string',
                                'enum' => ['low', 'medium', 'high', 'urgent'],
                                'description' => $isEn ? 'Filter by priority' : 'Lọc theo độ ưu tiên'
                            ],
                            'is_overdue' => [
                                'type' => 'boolean',
                                'description' => $isEn ? 'Set true to only get overdue tasks (due_date < now and not completed)' : 'Đặt true để chỉ lấy các task quá hạn (due_date < now và chưa hoàn thành)'
                            ]
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'create_task',
                    'description' => $isEn ? 'Create a new task or subtask.' : 'Tạo một công việc (task) mới hoặc công việc con (subtask).',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'project_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the project containing this task' : 'ID của dự án chứa công việc này'
                            ],
                            'title' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Title of the task to create' : 'Tiêu đề của công việc cần tạo'
                            ],
                            'description' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Detailed description of the task' : 'Mô tả chi tiết công việc'
                            ],
                            'priority' => [
                                'type' => 'string',
                                'enum' => ['low', 'medium', 'high', 'urgent'],
                                'description' => $isEn ? 'Priority level' : 'Mức độ ưu tiên'
                            ],
                            'assignee_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the user to assign' : 'ID của người được phân công'
                            ],
                            'due_date' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Due date in YYYY-MM-DD format' : 'Hạn chót hoàn thành định dạng YYYY-MM-DD'
                            ],
                            'parent_task_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the parent task if creating a subtask' : 'ID của task cha nếu muốn tạo subtask'
                            ]
                        ],
                        'required' => ['project_id', 'title']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'update_task',
                    'description' => $isEn ? 'Update fields of an existing task (title, status, assignee, due date...).' : 'Cập nhật các trường thông tin của một công việc đang có (tiêu đề, trạng thái, assignee, hạn chót...).',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'task_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the task to update' : 'ID của công việc cần cập nhật'
                            ],
                            'title' => [
                                'type' => 'string'
                            ],
                            'description' => [
                                'type' => 'string'
                            ],
                            'status' => [
                                'type' => 'string',
                                'description' => $isEn ? 'New status (e.g. todo, in_progress, review, done)' : 'Trạng thái mới (ví dụ: todo, in_progress, review, done)'
                            ],
                            'priority' => [
                                'type' => 'string',
                                'enum' => ['low', 'medium', 'high', 'urgent']
                            ],
                            'assignee_id' => [
                                'type' => 'integer'
                            ],
                            'due_date' => [
                                'type' => 'string',
                                'description' => $isEn ? 'New due date in YYYY-MM-DD format' : 'Mốc thời gian hạn chót mới YYYY-MM-DD'
                            ]
                        ],
                        'required' => ['task_id']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'add_comment',
                    'description' => $isEn ? 'Post a discussion comment to a task.' : 'Gửi bình luận thảo luận vào một công việc.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'task_id' => [
                                'type' => 'integer'
                            ],
                            'comment' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Comment content' : 'Nội dung bình luận'
                            ]
                        ],
                        'required' => ['task_id', 'comment']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'start_timer',
                    'description' => $isEn ? 'Start the timer to track work time for a task.' : 'Chạy đồng hồ ghi nhận thời gian làm việc (track time) cho một công việc.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'task_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the task to track time' : 'ID của task cần chạy timer'
                            ]
                        ],
                        'required' => ['task_id']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'stop_timer',
                    'description' => $isEn ? 'Stop the current running timer.' : 'Dừng đồng hồ ghi nhận thời gian làm việc hiện tại.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'task_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'ID of the task to stop timer' : 'ID của task cần dừng timer'
                            ]
                        ],
                        'required' => ['task_id']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_running_timer',
                    'description' => $isEn ? 'Get information of my currently running timer.' : 'Lấy thông tin timer hiện đang chạy của tôi.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => (object)[]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'list_users',
                    'description' => $isEn ? 'Get a list of members in the system to search for their IDs by name. Always provide project_id if you want to find members belonging to a specific project.' : 'Lấy danh sách thành viên trong hệ thống để tìm kiếm ID của họ qua tên. Luôn truyền project_id nếu muốn tìm các thành viên thuộc một dự án cụ thể.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'project_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Optional project ID to filter members.' : 'ID dự án để lọc các thành viên (không bắt buộc).'
                            ]
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'list_time_entries',
                    'description' => $isEn ? 'Get a list of logged work time entries (old logs) for the current user or specific filters.' : 'Lấy danh sách các bản ghi thời gian (log cũ) đã log của người dùng hiện tại hoặc các bộ lọc.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'user_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Filter by user ID' : 'Lọc theo ID người dùng'
                            ],
                            'task_id' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Filter by task ID' : 'Lọc theo ID công việc'
                            ],
                            'date' => [
                                'type' => 'string',
                                'description' => $isEn ? 'Filter by date in YYYY-MM-DD format (e.g. today)' : 'Lọc theo ngày định dạng YYYY-MM-DD'
                            ],
                            'limit' => [
                                'type' => 'integer',
                                'description' => $isEn ? 'Limit results count' : 'Giới hạn số lượng kết quả'
                            ]
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_stuck_tasks',
                    'description' => $isEn ? 'Get a list of stuck tasks (no activity or comments updated in the last 7 days).' : 'Lấy danh sách các công việc bị kẹt (không có cập nhật hoạt động hay bình luận gì trong vòng 7 ngày qua).',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => (object)[]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'suggest_follow_ups',
                    'description' => $isEn ? 'Register interactive follow-up question suggestion buttons at the bottom of the chat bubble to guide the user.' : 'Đăng ký các nút gợi ý câu hỏi tiếp theo tương tác ở dưới bong bóng chat để hướng dẫn người dùng.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'suggestions' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'string'
                                ],
                                'description' => $isEn ? 'List of suggested follow-up query strings (e.g. ["Start timer for task 5", "Create project Demo"])' : 'Danh sách các chuỗi câu lệnh gợi ý (Ví dụ: ["Chạy timer cho task 5", "Tạo dự án Demo"])'
                            ]
                        ],
                        'required' => ['suggestions']
                    ]
                ]
            ]
        ];
    }

    /**
     * Local execution of database action requests.
     */
    protected function executeTool(string $name, array $args, User $user, string $lang = 'vi'): array
    {
        $isEn = ($lang !== 'vi'); // Both en and ja use English for internal tool results
        try {
            switch ($name) {
                case 'list_projects':
                    $query = Project::query();
                    if ($user->role !== 'admin') {
                        $query->where('created_by', $user->id)
                            ->orWhereHas('members', function ($q) use ($user) {
                                $q->where('user_id', $user->id);
                            });
                    }
                    return [
                        'success' => true,
                        'projects' => $query->get(['id', 'name', 'description', 'priority', 'status'])->toArray()
                    ];

                case 'create_project':
                    $project = DB::transaction(function () use ($args, $user) {
                        $proj = Project::create([
                            'name' => $args['name'],
                            'description' => $args['description'] ?? null,
                            'color' => $args['color'] ?? '#6366f1',
                            'priority' => $args['priority'] ?? 'medium',
                            'status' => $args['status'] ?? 'active',
                            'created_by' => $user->id,
                        ]);
                        $proj->members()->attach($user->id, [
                            'role' => 'manager',
                            'joined_at' => now(),
                        ]);
                        return $proj;
                    });
                    $this->executedEvents[] = [
                        'type' => 'project_created',
                        'id' => $project->id,
                        'name' => $project->name
                    ];
                    return [
                        'success' => true,
                        'message' => $isEn ? 'Project created successfully!' : 'Dự án đã được tạo thành công!',
                        'project' => $project->toArray()
                    ];

                case 'list_tasks':
                    $query = Task::with(['assignee:id,name', 'project:id,name']);
                    if ($user->role !== 'admin') {
                        $query->whereHas('project', function ($q) use ($user) {
                            $q->where('created_by', $user->id)
                                ->orWhereHas('members', function ($sub) use ($user) {
                                    $sub->where('user_id', $user->id);
                                });
                        });
                    }
                    if (!empty($args['project_id'])) {
                        $query->where('project_id', $args['project_id']);
                    }
                    if (!empty($args['assignee_id'])) {
                        $query->where('assignee_id', $args['assignee_id']);
                    }
                    if (!empty($args['status'])) {
                        $query->where('status', $args['status']);
                    }
                    if (!empty($args['priority'])) {
                        $query->where('priority', $args['priority']);
                    }
                    if (!empty($args['is_overdue']) && $args['is_overdue'] === true) {
                        $query->where('due_date', '<', now())
                            ->whereNull('completed_at');
                    }
                    $tasks = $query->limit(25)->get(['id', 'project_id', 'title', 'status', 'priority', 'assignee_id', 'due_date'])->toArray();
                    return [
                        'success' => true,
                        'tasks' => $tasks
                    ];

                case 'create_task':
                    $project = Project::find($args['project_id']);
                    if (!$project) {
                        return ['success' => false, 'message' => $isEn ? 'Project not found.' : 'Không tìm thấy dự án tương ứng.'];
                    }

                    if (!empty($args['assignee_id'])) {
                        $isMember = $project->members()->where('users.id', $args['assignee_id'])->exists();
                        if (!$isMember) {
                            return [
                                'success' => false,
                                'message' => $isEn 
                                    ? 'This user is not a member of the project. You can only assign tasks to project members.' 
                                    : 'Người dùng này không phải là thành viên của dự án. Bạn chỉ có thể gán công việc cho thành viên thuộc dự án này thôi.'
                            ];
                        }
                    }

                    $defaultStatus = $project->statuses[0]['id'] ?? 'todo';
                    
                    // Positions calculation
                    $maxPosition = Task::where('project_id', $args['project_id'])->max('position') ?? 0;

                    $task = Task::create([
                        'project_id' => $args['project_id'],
                        'title' => $args['title'],
                        'description' => $args['description'] ?? null,
                        'status' => $defaultStatus,
                        'priority' => $args['priority'] ?? 'medium',
                        'assignee_id' => $args['assignee_id'] ?? null,
                        'creator_id' => $user->id,
                        'due_date' => !empty($args['due_date']) ? Carbon::parse($args['due_date']) : null,
                        'parent_task_id' => $args['parent_task_id'] ?? null,
                        'position' => $maxPosition + 1,
                    ]);

                    TaskActivity::create([
                        'task_id' => $task->id,
                        'user_id' => $user->id,
                        'action' => 'created',
                        'details' => $isEn ? 'Created by global AI assistant.' : 'Tạo bởi trợ lý AI toàn cầu.'
                    ]);

                    $task->load('assignee');
                    event(new TaskUpdated((int)$task->project_id, 'created', $task->toArray()));

                    $this->executedEvents[] = [
                        'type' => 'task_created',
                        'id' => $task->id,
                        'project_id' => $task->project_id,
                        'title' => $task->title
                    ];

                    return [
                        'success' => true,
                        'message' => $isEn ? 'Task created successfully!' : 'Task đã được tạo thành công!',
                        'task' => $task->toArray()
                    ];

                case 'update_task':
                    $task = Task::find($args['task_id']);
                    if (!$task) {
                        return ['success' => false, 'message' => $isEn ? 'Task not found.' : 'Không tìm thấy công việc tương ứng.'];
                    }

                    if (!empty($args['assignee_id'])) {
                        $isMember = $task->project->members()->where('users.id', $args['assignee_id'])->exists();
                        if (!$isMember) {
                            return [
                                'success' => false,
                                'message' => $isEn 
                                    ? 'This user is not a member of the project. You can only assign tasks to project members.' 
                                    : 'Người dùng này không phải là thành viên của dự án. Bạn chỉ có thể gán công việc cho thành viên thuộc dự án này thôi.'
                            ];
                        }
                    }

                    $oldStatus = $task->status;
                    $updates = [];
                    if (isset($args['title'])) $updates['title'] = $args['title'];
                    if (isset($args['description'])) $updates['description'] = $args['description'];
                    if (isset($args['priority'])) $updates['priority'] = $args['priority'];
                    if (isset($args['assignee_id'])) $updates['assignee_id'] = $args['assignee_id'];
                    if (isset($args['due_date'])) $updates['due_date'] = Carbon::parse($args['due_date']);
                    
                    if (isset($args['status'])) {
                        $updates['status'] = $args['status'];
                        $project = $task->project;
                        $newIsClosed = false;
                        foreach (($project->statuses ?? []) as $s) {
                            if ($s['id'] === $args['status'] && in_array($s['type'] ?? '', ['closed', 'done'])) {
                                $newIsClosed = true;
                                break;
                            }
                        }
                        $updates['completed_at'] = $newIsClosed ? now() : null;
                    }

                    $task->update($updates);

                    TaskActivity::create([
                        'task_id' => $task->id,
                        'user_id' => $user->id,
                        'action' => 'updated',
                        'details' => $isEn ? 'Updated by global AI assistant.' : 'Cập nhật bởi trợ lý AI toàn cầu.'
                    ]);

                    if (isset($args['status']) && $args['status'] !== $oldStatus) {
                        TaskActivity::create([
                            'task_id' => $task->id,
                            'user_id' => $user->id,
                            'action' => 'updated_status',
                            'details' => "Changed status from '{$oldStatus}' to '{$task->status}'"
                        ]);
                    }

                    $task->load('assignee');
                    event(new TaskUpdated((int)$task->project_id, 'updated', $task->toArray()));

                    return [
                        'success' => true,
                        'message' => $isEn ? 'Task updated successfully!' : 'Cập nhật công việc thành công!',
                        'task' => $task->toArray()
                    ];

                case 'add_comment':
                    $comment = TaskComment::create([
                        'task_id' => $args['task_id'],
                        'user_id' => $user->id,
                        'comment' => $args['comment'],
                    ]);

                    TaskActivity::create([
                        'task_id' => $args['task_id'],
                        'user_id' => $user->id,
                        'action' => 'commented',
                        'details' => $isEn ? 'Posted comment via AI assistant.' : 'Đã gửi bình luận qua trợ lý AI.'
                    ]);

                    $task = Task::find($args['task_id']);
                    if ($task) {
                        event(new TaskUpdated((int)$task->project_id, 'comment_created', [
                            'task_id' => (int)$task->id,
                            'comment' => $comment->load('user')->toArray()
                        ]));
                    }

                    return [
                        'success' => true,
                        'message' => $isEn ? 'Comment posted successfully!' : 'Bình luận đã gửi thành công!',
                        'comment' => $comment->toArray()
                    ];

                case 'start_timer':
                    $task = Task::find($args['task_id']);
                    if (!$task) {
                        return ['success' => false, 'message' => $isEn ? 'Task not found.' : 'Không tìm thấy task.'];
                    }

                    $project = $task->project;
                    if ($user->role !== 'admin' && $project->created_by !== $user->id && !$project->members->contains($user->id)) {
                        return [
                            'success' => false,
                            'message' => $isEn ? 'Unauthorized to track time on this task.' : 'Bạn không có quyền ghi nhận thời gian cho công việc này.'
                        ];
                    }

                    if (!$task->assignee_id) {
                        return [
                            'success' => false,
                            'message' => $isEn 
                                ? 'Cannot track time on an unassigned task. Please assign the task first.' 
                                : 'Không thể ghi nhận thời gian cho công việc chưa được gán cho ai. Vui lòng gán công việc trước.'
                        ];
                    }

                    // Stop running timers
                    TimeEntry::where('user_id', $user->id)
                        ->whereNull('ended_at')
                        ->get()
                        ->each(function ($oldEntry) use ($user, $isEn) {
                            $oldEntry->ended_at = now();
                            $oldEntry->duration = abs($oldEntry->ended_at->diffInSeconds($oldEntry->started_at));
                            $oldEntry->save();

                            TaskActivity::create([
                                'task_id' => $oldEntry->task_id,
                                'user_id' => $user->id,
                                'action' => 'stopped_timer',
                                'details' => $isEn ? 'Automatically stopped when starting new timer via AI.' : 'Tự động dừng khi bắt đầu timer mới qua AI.'
                            ]);

                            $oldTask = Task::find($oldEntry->task_id);
                            if ($oldTask) {
                                event(new TimeTrackingUpdated((int)$oldTask->project_id, (int)$user->id, 'stopped', $oldEntry->toArray()));
                            }
                        });

                    $entry = TimeEntry::create([
                        'task_id' => $args['task_id'],
                        'user_id' => $user->id,
                        'started_at' => now(),
                        'duration' => 0
                    ]);

                    TaskActivity::create([
                        'task_id' => $args['task_id'],
                        'user_id' => $user->id,
                        'action' => 'started_timer',
                        'details' => $isEn ? 'Started timer via AI assistant.' : 'Bắt đầu đếm giờ qua trợ lý AI.'
                    ]);

                    event(new TimeTrackingUpdated((int)$task->project_id, (int)$user->id, 'started', $entry->toArray()));

                    return [
                        'success' => true,
                        'message' => $isEn ? 'Timer started successfully.' : 'Đã chạy đồng hồ ghi nhận thời gian.',
                        'timer' => $entry->toArray()
                    ];

                case 'stop_timer':
                    $entry = TimeEntry::where('task_id', $args['task_id'])
                        ->where('user_id', $user->id)
                        ->whereNull('ended_at')
                        ->first();

                    if (!$entry) {
                        return ['success' => false, 'message' => $isEn ? 'No running timer found for this task.' : 'Không tìm thấy timer đang chạy cho task này.'];
                    }

                    $entry->ended_at = now();
                    $entry->duration = abs($entry->ended_at->diffInSeconds($entry->started_at));
                    $entry->save();

                    TaskActivity::create([
                        'task_id' => $args['task_id'],
                        'user_id' => $user->id,
                        'action' => 'stopped_timer',
                        'details' => $isEn ? 'Stopped timer via AI assistant.' : 'Dừng đếm giờ qua trợ lý AI.'
                    ]);

                    $task = Task::find($args['task_id']);
                    if ($task) {
                        event(new TimeTrackingUpdated((int)$task->project_id, (int)$user->id, 'stopped', $entry->toArray()));
                    }

                    return [
                        'success' => true,
                        'message' => $isEn ? 'Timer stopped successfully!' : 'Đã dừng đồng hồ thành công!',
                        'logged_seconds' => $entry->duration
                    ];

                case 'get_running_timer':
                    $entry = TimeEntry::where('user_id', $user->id)
                        ->whereNull('ended_at')
                        ->with('task:id,title,project_id')
                        ->first();

                    return [
                        'success' => true,
                        'timer' => $entry ? $entry->toArray() : null
                    ];

                case 'list_time_entries':
                    $query = TimeEntry::with(['task:id,title,project_id', 'task.project:id,name']);
                    if (!empty($args['user_id'])) {
                        $query->where('user_id', $args['user_id']);
                    } else {
                        $query->where('user_id', $user->id);
                    }
                    if (!empty($args['task_id'])) {
                        $query->where('task_id', $args['task_id']);
                    }
                    if (!empty($args['date'])) {
                        $date = Carbon::parse($args['date']);
                        $query->whereDate('started_at', $date);
                    }

                    $limit = $args['limit'] ?? 20;
                    $entries = $query->orderBy('started_at', 'desc')->limit($limit)->get()->toArray();

                    return [
                        'success' => true,
                        'time_entries' => $entries
                    ];

                case 'list_users':
                    $query = User::query();
                    if (!empty($args['project_id'])) {
                        $query->whereHas('projects', function ($q) use ($args) {
                            $q->where('projects.id', $args['project_id']);
                        });
                    }
                    return [
                        'success' => true,
                        'users' => $query->get(['users.id', 'users.name', 'users.email', 'users.work_position'])->toArray()
                    ];

                case 'get_stuck_tasks':
                    // Inactive tasks in the last 7 days (updated_at <= 7 days ago and not in closed/done status)
                    $stuckTasks = Task::with(['project:id,name'])
                        ->whereNull('completed_at')
                        ->where('updated_at', '<=', now()->subDays(7))
                        ->limit(15)
                        ->get(['id', 'title', 'project_id', 'status', 'updated_at'])
                        ->toArray();

                    return [
                        'success' => true,
                        'tasks' => $stuckTasks
                    ];
            }
        } catch (\Exception $e) {
            Log::error("Tool execution failed: {$name}", [
                'args' => $args,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'message' => ($isEn ? "Tool execution error: " : "Lỗi thực thi tool: ") . $e->getMessage()];
        }

        return ['success' => false, 'message' => $isEn ? 'Invalid tool.' : 'Tool không hợp lệ.'];
    }

    /**
     * Fallback mock global chat when key is not configured.
     * Uses regex to parse mock commands to create tasks/projects/timers directly in the DB!
     */
    protected function handleMockGlobalChat(array $messages, User $user): array
    {
        $lang = $this->getLanguage();
        $isEn = ($lang !== 'vi'); // Both en and ja use English for mock mode
        $this->executedEvents = [];
        $lastMessage = end($messages);
        $text = $lastMessage['content'] ?? '';
        $reply = "";
        $actions = [];

        // 1. Simulation notice
        $notice = $isEn
            ? "⚠️ **Notice:** Currently `OPENAI_API_KEY` is not configured in `.env`. The system is running in **Smart Mock Mode**. I can still help you create projects/tasks/timers directly in the database by analyzing your commands:\n\n"
            : "⚠️ **Lưu ý:** Hiện tại `OPENAI_API_KEY` chưa cấu hình trong `.env`. Hệ thống đang chạy ở **chế độ mô phỏng thông minh (Smart Mock Mode)**. Tôi vẫn có thể giúp bạn tạo dự án/task/timer thực tế thông qua việc phân tích lệnh trực tiếp:\n\n";

        // 2. Command analysis using regex (supporting both Vietnamese and English regexes!)
        if (preg_match('/(?:tạo dự án|create project)\s+["\'«]([^"\'»]+)["\'»]/ui', $text, $matches)) {
            $name = trim($matches[1]);
            $res = $this->executeTool('create_project', ['name' => $name, 'description' => $isEn ? 'Project created in AI simulation mode.' : 'Dự án tạo thử nghiệm ở chế độ mô phỏng AI.'], $user, $lang);
            
            $reply = $isEn
                ? $notice . "🚀 **Brain:** I have successfully created the project **\"{$name}\"** (ID: " . ($res['project']['id'] ?? 'N/A') . ")!\n\nWould you like me to create some demo tasks for this project?"
                : $notice . "🚀 **Brain:** Mình đã tạo thành công dự án thực tế **\"{$name}\"** (ID: " . ($res['project']['id'] ?? 'N/A') . ")!\n\nBạn có muốn mình tạo vài task demo cho dự án này không?";
                
            $actions = $isEn ? [
                "Create 3 demo tasks in the project",
                "Start timer for new task"
            ] : [
                "Tạo 3 task demo trong dự án vừa tạo",
                "Chạy timer cho công việc mới"
            ];
        } 
        elseif (preg_match('/(?:tạo dự án|tạo project|create project)/ui', $text)) {
            $reply = $isEn
                ? $notice . "🚀 **Brain:** To create a project, please provide a project name enclosed in quotes.\n\nFor example: `create project \"My New Project\"`"
                : $notice . "🚀 **Brain:** Để tạo dự án, vui lòng cung cấp tên dự án nằm trong dấu nháy kép.\n\nVí dụ: `tạo dự án \"Dự án mới của tôi\"`";
            $actions = $isEn ? [
                "Create project \"Demo Project 1\"",
                "View project list"
            ] : [
                "Tạo dự án \"Dự án Demo 1\"",
                "Xem danh sách dự án"
            ];
        }
        elseif (preg_match('/(?:tạo task|tạo công việc|create task)\s+["\'«]([^"\'»]+)["\'»]/ui', $text, $matches)) {
            $title = trim($matches[1]);
            $projectId = null;
            if (preg_match('/(?:trong dự án|in project)\s+(\d+)/ui', $text, $projMatches)) {
                $projectId = (int)$projMatches[1];
            }

            if ($projectId) {
                $project = Project::find($projectId);
                if (!$project) {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** Project ID **{$projectId}** not found. Please verify the ID or view the project list."
                        : $notice . "🚀 **Brain:** Không tìm thấy dự án với ID **{$projectId}**. Vui lòng kiểm tra lại hoặc xem danh sách dự án.";
                    $actions = $isEn ? ["View project list"] : ["Xem danh sách dự án"];
                    return [
                        'reply' => $reply,
                        'actions' => $actions,
                        'events' => $this->executedEvents
                    ];
                }
            } else {
                $project = Project::latest()->first();
                if (!$project) {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** No project found in the system to create tasks. Please create a project first (e.g. `create project \"Project 1\"`)."
                        : $notice . "🚀 **Brain:** Không tìm thấy dự án nào trong hệ thống để tạo task. Vui lòng tạo dự án trước (Ví dụ: `tạo dự án \"Dự án 1\"`).";
                    $actions = $isEn ? ["Create project \"New Project\""] : ["Tạo dự án \"Dự án mới\""];
                    return [
                        'reply' => $reply,
                        'actions' => $actions,
                        'events' => $this->executedEvents
                    ];
                }
            }

            // Create task using executeTool
            $res = $this->executeTool('create_task', [
                'project_id' => $project->id,
                'title' => $title,
                'priority' => 'medium'
            ], $user, $lang);

            if ($res['success']) {
                $taskId = $res['task']['id'] ?? 'N/A';
                if ($projectId) {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** I have successfully created task **\"{$title}\"** (ID: {$taskId}) in project **\"{$project->name}\"**!"
                        : $notice . "🚀 **Brain:** Mình đã tạo thành công công việc **\"{$title}\"** (ID: {$taskId}) trong dự án **\"{$project->name}\"**!";
                } else {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** I have created task **\"{$title}\"** (ID: {$taskId}) in the latest project **\"{$project->name}\"** (ID: {$project->id}).\n\nIf you want to specify a project, write: `create task \"Title\" in project {$project->id}`"
                        : $notice . "🚀 **Brain:** Mình đã tạo công việc **\"{$title}\"** (ID: {$taskId}) trong dự án gần đây nhất **\"{$project->name}\"** (ID: {$project->id}).\n\nNếu muốn chỉ định dự án cụ thể, bạn có thể nhập: `tạo task \"Tên task\" trong dự án {$project->id}`";
                }
                $actions = $isEn ? [
                    "Start timer for task {$taskId}",
                    "Update status task {$taskId} to completed"
                ] : [
                    "Bật timer cho task {$taskId}",
                    "Update status task {$taskId} sang hoàn thành"
                ];
            } else {
                $reply = $notice . "🚀 **Brain:** " . ($isEn ? "Error: " : "Lỗi: ") . ($res['message'] ?? ($isEn ? 'Cannot create task.' : 'Không thể tạo task.'));
            }
        }
        elseif (preg_match('/(?:tạo task|tạo công việc|create task)/ui', $text) && !preg_match('/(?:tạo task demo|tạo 3 task demo|create 3 demo tasks|create demo tasks)/ui', $text)) {
            $projectId = null;
            if (preg_match('/(?:trong dự án|in project)\s+(\d+)/ui', $text, $projMatches)) {
                $projectId = (int)$projMatches[1];
            }

            if ($projectId) {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** To create a task in project ID **{$projectId}**, please provide a task title enclosed in quotes.\n\nFor example: `create task \"My Task Name\" in project {$projectId}`"
                    : $notice . "🚀 **Brain:** Để tạo công việc trong dự án ID **{$projectId}**, vui lòng cung cấp tiêu đề công việc nằm trong dấu nháy kép.\n\nVí dụ: `tạo task \"Tên công việc\" trong dự án {$projectId}`";
            } else {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** To create a task, please provide a task title in quotes and specify the project ID.\n\nFor example: `create task \"My New Task\" in project 1`"
                    : $notice . "🚀 **Brain:** Để tạo công việc mới, vui lòng cung cấp tiêu đề công việc trong dấu nháy kép và chỉ định dự án.\n\nVí dụ: `tạo task \"Tên công việc mới\" trong dự án 1`";
            }
            $actions = $isEn ? ["View project list"] : ["Xem danh sách dự án"];
        } 
        elseif (preg_match('/(?:tạo task demo|tạo 3 task demo|create 3 demo tasks|create demo tasks)/ui', $text)) {
            $proj = Project::latest()->first();
            if ($proj) {
                $t1 = $this->executeTool('create_task', ['project_id' => $proj->id, 'title' => $isEn ? 'Define scope of demo project' : 'Thiết lập phạm vi dự án demo', 'priority' => 'high'], $user, $lang);
                $t2 = $this->executeTool('create_task', ['project_id' => $proj->id, 'title' => $isEn ? 'Create timeline plan' : 'Tạo kế hoạch mốc thời gian', 'priority' => 'medium'], $user, $lang);
                $t3 = $this->executeTool('create_task', ['project_id' => $proj->id, 'title' => $isEn ? 'Prepare handover checklist' : 'Chuẩn bị checklist bàn giao', 'priority' => 'low'], $user, $lang);
                
                if ($isEn) {
                    $reply = $notice . "🚀 **Brain:** I have created 3 demo tasks in project **\"{$proj->name}\"**:\n\n"
                        . "1. ⚪ **Define scope of demo project** (ID: " . ($t1['task']['id'] ?? 'N/A') . ") [URGENT/HIGH]\n"
                        . "2. ⚪ **Create timeline plan** (ID: " . ($t2['task']['id'] ?? 'N/A') . ") [MEDIUM]\n"
                        . "3. ⚪ **Prepare handover checklist** (ID: " . ($t3['task']['id'] ?? 'N/A') . ") [LOW]\n\n"
                        . "Would you like me to update status or start timer for any task?";
                    $actions = [
                        "Start timer for task " . ($t1['task']['id'] ?? ''),
                        "Update status task " . ($t2['task']['id'] ?? '') . " to completed"
                    ];
                } else {
                    $reply = $notice . "🚀 **Brain:** Mình đã tạo 3 task demo thực tế trong dự án **\"{$proj->name}\"**:\n\n"
                        . "1. ⚪ **Thiết lập phạm vi dự án demo** (ID: " . ($t1['task']['id'] ?? 'N/A') . ") [URGENT/HIGH]\n"
                        . "2. ⚪ **Tạo kế hoạch mốc thời gian** (ID: " . ($t2['task']['id'] ?? 'N/A') . ") [MEDIUM]\n"
                        . "3. ⚪ **Chuẩn bị checklist bàn giao** (ID: " . ($t3['task']['id'] ?? 'N/A') . ") [LOW]\n\n"
                        . "Bạn muốn mình cập nhật trạng thái hay bật timer chạy cho task nào?";
                    $actions = [
                        "Bật timer cho task " . ($t1['task']['id'] ?? ''),
                        "Update status task " . ($t2['task']['id'] ?? '') . " sang hoàn thành"
                    ];
                }
            } else {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** No project found in the system to create tasks. Please create a project first (e.g. `create project \"Project 1\"`)."
                    : $notice . "🚀 **Brain:** Không tìm thấy dự án nào trong hệ thống để tạo task. Vui lòng tạo dự án trước (Ví dụ: `tạo dự án \"Dự án 1\"`).";
            }
        } 
        elseif (preg_match('/(?:update status task|cập nhật trạng thái task)\s+(\d+)\s+(?:sang hoàn thành|thành hoàn thành|to completed|to done)/ui', $text, $matches)) {
            $taskId = (int)$matches[1];
            $res = $this->executeTool('update_task', ['task_id' => $taskId, 'status' => 'done'], $user, $lang);
            if ($res['success']) {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** I have updated the status of task ID **{$taskId}** to **Completed (COMPLETE) ✅**!\n\nWould you like me to post a comment?"
                    : $notice . "🚀 **Brain:** Mình đã cập nhật trạng thái công việc ID **{$taskId}** sang trạng thái **Hoàn thành (COMPLETE) ✅**!\n\nBạn có muốn mình đóng góp bình luận gì thêm không?";
                $actions = $isEn ? [
                    "Add comment to task {$taskId}",
                    "View project list"
                ] : [
                    "Thêm bình luận vào task {$taskId}",
                    "Xem danh sách dự án"
                ];
            } else {
                $reply = $notice . "🚀 **Brain:** " . ($isEn ? "Error: " : "Lỗi: ") . ($res['message'] ?? ($isEn ? 'Task not found.' : 'Không tìm thấy task tương ứng.'));
            }
        } 
        elseif (preg_match('/(?:bật timer cho task|chạy timer cho task|timer start|chạy timer|start timer for task|start timer)\s*(\d+)?/ui', $text, $matches)) {
            $taskId = isset($matches[1]) ? (int)$matches[1] : null;
            if (!$taskId) {
                $task = Task::latest()->first();
                $taskId = $task ? $task->id : null;
            }
            if ($taskId) {
                $res = $this->executeTool('start_timer', ['task_id' => $taskId], $user, $lang);
                if ($res['success']) {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** I have activated the real-time work timer for task ID **{$taskId}**! ⏱️\n\nYou can stop the timer at any time."
                        : $notice . "🚀 **Brain:** Mình đã kích hoạt đồng hồ ghi nhận thời gian thực cho công việc ID **{$taskId}**! ⏱️\n\nBạn có thể dừng đếm giờ bất cứ lúc nào.";
                    $actions = $isEn ? [
                        "Stop timer for task {$taskId}",
                        "View running timer"
                    ] : [
                        "Dừng timer cho task {$taskId}",
                        "Xem timer đang chạy"
                    ];
                } else {
                    $reply = $notice . "🚀 **Brain:** " . ($isEn ? "Error: " : "Lỗi: ") . ($res['message'] ?? ($isEn ? 'Cannot start timer.' : 'Không thể bật timer.'));
                }
            } else {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** No task available to start timer."
                    : $notice . "🚀 **Brain:** Không có task nào để bắt đầu đếm giờ.";
            }
        } 
        elseif (preg_match('/(?:dừng timer cho task|dừng timer|stop timer|stop timer for task)\s*(\d+)?/ui', $text, $matches)) {
            $taskId = isset($matches[1]) ? (int)$matches[1] : null;
            if (!$taskId) {
                $running = TimeEntry::where('user_id', $user->id)->whereNull('ended_at')->first();
                $taskId = $running ? $running->task_id : null;
            }
            if ($taskId) {
                $res = $this->executeTool('stop_timer', ['task_id' => $taskId], $user, $lang);
                if ($res['success']) {
                    $reply = $isEn
                        ? $notice . "🚀 **Brain:** I have stopped the timer and logged the work time for task ID **{$taskId}**!"
                        : $notice . "🚀 **Brain:** Mình đã dừng đồng hồ và ghi nhận thời gian thành công cho công việc ID **{$taskId}**!";
                    $actions = $isEn ? [
                        "View project list",
                        "Find stuck tasks"
                    ] : [
                        "Xem danh sách dự án",
                        "Tìm các task bị kẹt"
                    ];
                } else {
                    $reply = $notice . "🚀 **Brain:** " . ($isEn ? "Error: " : "Lỗi: ") . ($res['message'] ?? ($isEn ? 'No running timer found to stop.' : 'Không có timer nào đang chạy để dừng.'));
                }
            } else {
                $reply = $isEn
                    ? $notice . "🚀 **Brain:** No running timer found to stop."
                    : $notice . "🚀 **Brain:** Không tìm thấy timer nào đang chạy để dừng.";
            }
        } 
        elseif (preg_match('/(?:xem danh sách dự án|list projects|dự án hiện có|view project list)/ui', $text)) {
            $res = $this->executeTool('list_projects', [], $user, $lang);
            $projList = "";
            foreach ($res['projects'] as $p) {
                $projList .= "- 📁 **{$p['name']}** (ID: {$p['id']}) - " . ($isEn ? "Priority" : "Độ ưu tiên") . ": {$p['priority']}\n";
            }
            $reply = $isEn
                ? $notice . "📁 **Brain:** Here is the list of active projects:\n\n" . ($projList ?: "No projects yet.")
                : $notice . "📁 **Brain:** Đây là danh sách các dự án thực tế hiện có:\n\n" . ($projList ?: "Chưa có dự án nào.");
            $actions = $isEn ? [
                "Create project \"New Demo Project\"",
                "Find stuck tasks"
            ] : [
                "Tạo dự án \"Dự án Demo mới\"",
                "Tìm các task bị kẹt"
            ];
        } 
        elseif (preg_match('/(?:thêm bình luận vào task|bình luận task|comment|add comment to task)\s+(\d+)\s+["\'«]([^"\'»]+)["\'»]/ui', $text, $matches)) {
            $taskId = (int)$matches[1];
            $cmt = trim($matches[2]);
            $res = $this->executeTool('add_comment', ['task_id' => $taskId, 'comment' => $cmt], $user, $lang);
            if ($res['success']) {
                $reply = $isEn
                    ? $notice . "💬 **Brain:** I have successfully added comment **\"{$cmt}\"** to task ID **{$taskId}**!"
                    : $notice . "💬 **Brain:** Mình đã gửi bình luận thực tế **\"{$cmt}\"** vào task ID **{$taskId}** thành công!";
            } else {
                $reply = $notice . "🚀 **Brain:** " . ($isEn ? "Error: " : "Lỗi: ") . ($res['message'] ?? ($isEn ? 'Cannot post comment.' : 'Không thể gửi bình luận.'));
            }
        }
        elseif (preg_match('/(?:xem timer đang chạy|xem log đang chạy|timer đang chạy|running timer|get running timer)/ui', $text)) {
            $res = $this->executeTool('get_running_timer', [], $user, $lang);
            $timer = $res['timer'] ?? null;
            if ($timer) {
                $taskTitle = $timer['task']['title'] ?? 'N/A';
                $started = Carbon::parse($timer['started_at']);
                $diff = now()->diff($started);
                $duration = sprintf('%02dh %02dm %02ds', $diff->h, $diff->i, $diff->s);

                $reply = $isEn
                    ? $notice . "⏱️ **Brain:** You have a running timer for task **\"{$taskTitle}\"** (ID: {$timer['task_id']}).\n\nIt started at **{$started->format('H:i:s')}** and has been running for **{$duration}**."
                    : $notice . "⏱️ **Brain:** Bạn đang có bộ đếm giờ (timer) chạy cho công việc **\"{$taskTitle}\"** (ID: {$timer['task_id']}).\n\nĐồng hồ bắt đầu từ lúc **{$started->format('H:i:s')}** và đã chạy được **{$duration}**.";
                $actions = $isEn ? ["Stop timer for task {$timer['task_id']}"] : ["Dừng timer cho task {$timer['task_id']}"];
            } else {
                $reply = $isEn
                    ? $notice . "⏱️ **Brain:** You don't have any running timer right now."
                    : $notice . "⏱️ **Brain:** Hiện tại không có bộ đếm giờ (timer) nào đang chạy cho tài khoản của bạn.";
                $actions = $isEn ? ["View project list", "Find stuck tasks"] : ["Xem danh sách dự án", "Tìm các task bị kẹt"];
            }
        }
        elseif (preg_match('/(?:hôm nay tôi đã log bao nhiêu|tổng thời gian đã log|xem log cũ|lịch sử log|log cũ|lịch sử chấm công|time entries|list time entries)/ui', $text)) {
            $today = Carbon::today()->toDateString();
            $res = $this->executeTool('list_time_entries', ['date' => $today], $user, $lang);
            $entries = $res['time_entries'] ?? [];

            if (empty($entries)) {
                $reply = $isEn
                    ? $notice . "📅 **Brain:** You haven't logged any time entries today."
                    : $notice . "📅 **Brain:** Bạn chưa ghi nhận (log) thời gian làm việc nào trong ngày hôm nay.";
                $actions = $isEn ? ["View project list"] : ["Xem danh sách dự án"];
            } else {
                $totalSeconds = 0;
                $listStr = "";
                foreach ($entries as $e) {
                    $taskTitle = $e['task']['title'] ?? 'N/A';
                    $durationSec = $e['duration'] ?? 0;
                    $totalSeconds += $durationSec;

                    $hours = floor($durationSec / 3600);
                    $minutes = floor(($durationSec % 3600) / 60);
                    $seconds = $durationSec % 60;

                    $durationStr = "";
                    if ($hours > 0) $durationStr .= "{$hours}h ";
                    if ($minutes > 0 || $hours > 0) $durationStr .= "{$minutes}m ";
                    $durationStr .= "{$seconds}s";

                    $started = Carbon::parse($e['started_at'])->format('H:i');
                    $listStr .= "- **{$taskTitle}** (ID: {$e['task_id']}): Logged **{$durationStr}** starting at {$started}\n";
                }

                $totHours = floor($totalSeconds / 3600);
                $totMins = floor(($totalSeconds % 3600) / 60);
                $totSecs = $totalSeconds % 60;
                $totStr = sprintf('%02dh %02dm %02ds', $totHours, $totMins, $totSecs);

                $reply = $isEn
                    ? $notice . "📅 **Brain:** You have logged a total of **{$totStr}** across " . count($entries) . " entries today:\n\n" . $listStr
                    : $notice . "📅 **Brain:** Hôm nay bạn đã ghi nhận tổng cộng **{$totStr}** qua " . count($entries) . " bản ghi:\n\n" . $listStr;

                $runningRes = $this->executeTool('get_running_timer', [], $user, $lang);
                if (!empty($runningRes['timer'])) {
                    $actions = $isEn ? ["Stop current running timer"] : ["Dừng timer đang chạy"];
                } else {
                    $actions = $isEn ? ["View project list", "Find stuck tasks"] : ["Xem danh sách dự án", "Tìm các task bị kẹt"];
                }
            }
        }
        else {
            if ($isEn) {
                $reply = $notice . "🤖 **Brain:** Hello! I am your global AI assistant. Since `OPENAI_API_KEY` is not configured, you can enter the following commands to experience live simulation with actual data:\n\n"
                    . "1. `create project \"Project Name\"` (Creates an actual project)\n"
                    . "2. `create 3 demo tasks` (Creates sample tasks in the latest project)\n"
                    . "3. `update status task <ID> to completed` (Updates a task's status)\n"
                    . "4. `start timer for task <ID>` (Runs work timer on a task)\n"
                    . "5. `stop timer` (Stops the active timer)\n"
                    . "6. `view project list` (Lists all projects in database)\n\n"
                    . "Feel free to type anything or click the suggestions below!";
                $actions = [
                    "Create project \"Test Project 1\"",
                    "View project list",
                    "Start timer for new task"
                ];
            } else {
                $reply = $notice . "🤖 **Brain:** Xin chào! Tôi là Trợ lý AI toàn cầu. Vì `OPENAI_API_KEY` chưa cấu hình, bạn có thể nhập thử các lệnh sau để trải nghiệm tính năng mô phỏng tương tác dữ liệu thực:\n\n"
                    . "1. `tạo dự án \"Tên dự án\"` (Tạo dự án thực tế)\n"
                    . "2. `tạo 3 task demo` (Tạo 3 công việc mẫu trong dự án gần nhất)\n"
                    . "3. `update status task <ID> sang hoàn thành` (Cập nhật trạng thái công việc)\n"
                    . "4. `bật timer cho task <ID>` (Chạy đồng hồ ghi nhận thời gian)\n"
                    . "5. `dừng timer` (Dừng đồng hồ ghi nhận thời gian)\n"
                    . "6. `xem danh sách dự án` (Lấy danh sách các dự án hiện có)\n\n"
                    . "Hãy nhập câu hỏi bất kỳ hoặc click các gợi ý bên dưới!";
                $actions = [
                    "Tạo dự án \"Dự án Thử nghiệm 1\"",
                    "Xem danh sách dự án",
                    "Chạy timer cho công việc mới"
                ];
            }
        }

        return [
            'reply' => $reply,
            'actions' => $actions,
            'events' => $this->executedEvents
        ];
    }

    /**
     * Fallback mock checklist when API key is missing or calls fail.
     */
    protected function getMockChecklist(string $title, string $lang = 'vi'): array
    {
        return match ($lang) {
            'en' => [
                "Analyze requirement description for: {$title}",
                "Outline implementation plan & Initial UI mockup designs",
                "Implement development of the core components",
                "Perform automated and manual unit tests",
                "Review code & Deploy to staging environment",
                "Handover task deliverables & Update task workflow status"
            ],
            'ja' => [
                "要件説明の分析: {$title}",
                "実装計画の策定 & UIモックアップの初期デザイン",
                "コアコンポーネントの開発実装",
                "自動および手動ユニットテストの実施",
                "コードレビュー & ステージング環境へのデプロイ",
                "タスク成果物の引き渡し & ワークフローステータスの更新"
            ],
            default => [
                "Phân tích yêu cầu công việc cho: {$title}",
                "Lên kế hoạch thực hiện & Mockup giao diện sơ bộ",
                "Lập trình phát triển các cấu phần chính",
                "Kiểm thử tính năng tự động và thủ công",
                "Review code & Triển khai lên môi trường staging",
                "Bàn giao công việc và cập nhật trạng thái Task"
            ],
        };
    }

    /**
     * Generate subtasks using OpenAI.
     */
    public function generateSubtasks(string $title, ?string $description = '', ?string $additionalPrompt = ''): array
    {
        $lang = $this->getLanguage();
        if (!$this->isConfigured()) {
            return $this->getMockSubtasks($title, $lang);
        }

        $targetLang = $this->getTargetLanguageName($lang);
        $exampleFormat = match ($lang) {
            'en' => '{"subtasks": ["Prepare document", "Design UI mockup", "Program backend API"]}',
            'ja' => '{"subtasks": ["資料を準備する", "UIモックアップをデザインする", "バックエンドAPIを開発する"]}',
            default => '{"subtasks": ["Chuẩn bị tài liệu", "Thiết kế giao diện mockup", "Lập trình API backend"]}',
        };

        $systemPrompt = "You are a highly efficient project management assistant. "
            . "Generate a list of subtasks for a parent task titled '{$title}'. "
            . "Parent Task Description: '{$description}'.\n"
            . "Return ONLY a JSON object with a single key 'subtasks' containing an array of strings representing the subtask titles. "
            . "Make them clear, actionable, and specific. Do not include markdown formatting like ```json ... ```. "
            . "Translate to {$targetLang} since the user is using {$targetLang}. "
            . "Example format: {$exampleFormat}";

        $userPrompt = "Please generate 3 to 6 subtask titles.";
        if ($additionalPrompt) {
            $userPrompt .= " Additional guidelines: {$additionalPrompt}";
        }

        try {
            $response = $this->postChatCompletion([
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt]
                ],
                'response_format' => ['type' => 'json_object'],
                'temperature' => 0.7,
            ], 20);

            if ($response->successful()) {
                $data = $response->json();
                $content = $data['choices'][0]['message']['content'] ?? '{}';
                $decoded = json_decode($content, true);
                if (isset($decoded['subtasks']) && is_array($decoded['subtasks'])) {
                    return $decoded['subtasks'];
                }
            }

            Log::error('OpenAiService subtasks generator failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
        } catch (\Exception $e) {
            Log::error('OpenAiService subtasks generator exception', [
                'message' => $e->getMessage()
            ]);
        }

        return $this->getMockSubtasks($title, $lang);
    }

    /**
     * Fallback mock subtasks.
     */
    protected function getMockSubtasks(string $title, string $lang = 'vi'): array
    {
        return match ($lang) {
            'en' => [
                "Research details for: {$title}",
                "Draft timeline & architecture design",
                "Implement codebase modifications",
                "Verify features & deploy code"
            ],
            'ja' => [
                "詳細要件の調査: {$title}",
                "タイムライン & アーキテクチャ設計の草案",
                "コードベースの修正実装",
                "機能検証 & デプロイ"
            ],
            default => [
                "Nghiên cứu chi tiết yêu cầu cho: {$title}",
                "Lên kế hoạch thực hiện & Thiết kế cấu trúc",
                "Lập trình phát triển code",
                "Kiểm thử và triển khai bàn giao"
            ],
        };
    }

    /**
     * Generate task description using OpenAI.
     */
    public function generateDescription(string $title, ?string $additionalPrompt = ''): string
    {
        $lang = $this->getLanguage();
        if (!$this->isConfigured()) {
            return $this->getMockDescription($title, $lang);
        }

        $targetLang = $this->getTargetLanguageName($lang);
        $systemPrompt = "You are a highly efficient project management assistant. "
            . "Write a detailed and professional description for a task titled '{$title}'. "
            . "Use markdown formatting for structure (e.g. bold titles, bullet points). "
            . "Write the description in {$targetLang}.\n"
            . "CRITICAL RULE: Return ONLY the actual task description content. Do NOT include any introductory text, conversational greetings, explanations, or concluding remarks (such as 'Here is the description:', 'Dưới đây là...', etc.). Start directly with the first section header or content.";

        $userPrompt = "Please generate a description.";
        if ($additionalPrompt) {
            $userPrompt .= " Additional guidelines/requirements: {$additionalPrompt}";
        }

        try {
            $response = $this->postChatCompletion([
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt]
                ],
                'temperature' => 0.7,
            ], 20);

            if ($response->successful()) {
                $data = $response->json();
                $content = trim($data['choices'][0]['message']['content'] ?? '');
                return $this->stripConversationalIntro($content);
            }

            Log::error('OpenAiService description generator failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
        } catch (\Exception $e) {
            Log::error('OpenAiService description generator exception', [
                'message' => $e->getMessage()
            ]);
        }

        return $this->getMockDescription($title, $lang);
    }

    /**
     * Clean up description text by removing conversational introductions.
     */
    public function stripConversationalIntro(string $text): string
    {
        $text = trim($text);

        $patterns = [
            '/^(dưới đây là|đây là|bản mô tả|sau đây là|here is|here\'s|below is|this is|following is|以下の|この)[^\n]{1,250}(:|\.|\!)\s*\n+/iu'
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $text = preg_replace($pattern, '', $text);
                break;
            }
        }

        return trim($text);
    }

    /**
     * Fallback mock description.
     */
    protected function getMockDescription(string $title, string $lang = 'vi'): string
    {
        return match ($lang) {
            'en' => "### Overview\nThis task aims to: **{$title}**.\n\n### Key Implementation Steps\n- Survey detailed requirements & plan\n- Code feature & perform integration tests\n- Accept feature and release",
            'ja' => "### 概要\nこのタスクの目的： **{$title}**.\n\n### 主な実施手順\n- 詳細要件 of 調査と計画策定\n- 機能の実装と統合テストの実施\n- 機能検証とリリース",
            default => "### Tổng quan\nCông việc này nhằm thực hiện: **{$title}**.\n\n### Các bước triển khai chính\n- Khảo sát yêu cầu chi tiết & lên phương án\n- Lập trình tính năng & kiểm thử liên thông\n- Nghiệm thu tính năng và phát hành",
        };
    }

    /**
     * Send a POST request to /chat/completions with streaming enabled.
     */
    public function postChatCompletionStream(array $payload, callable $onChunk, int $timeout = 40): void
    {
        $payload['stream'] = true;
        $lastException = null;

        foreach ($this->models as $model) {
            $payload['model'] = $model;

            try {
                $response = Http::timeout($timeout)
                    ->withToken($this->apiKey)
                    ->withOptions([
                        'stream' => true,
                    ])
                    ->post(rtrim($this->baseUrl, '/') . '/chat/completions', $payload);

                if ($response->successful()) {
                    $this->model = $model;
                    $this->models = array_values(array_unique(array_merge([$model], $this->models)));

                    $body = $response->getBody();
                    $resource = $body->detach();
                    if (is_resource($resource)) {
                        while (!feof($resource)) {
                            $line = fgets($resource);
                            if ($line === false) {
                                continue;
                            }

                            $line = trim($line);
                            if ($line === '') {
                                continue;
                            }

                            if (str_starts_with($line, 'data: ')) {
                                $dataStr = substr($line, 6);
                                if ($dataStr === '[DONE]') {
                                    $onChunk(['done' => true]);
                                    break;
                                }

                                $data = json_decode($dataStr, true);
                                if ($data) {
                                    $onChunk(['data' => $data]);
                                }
                            }
                        }
                        fclose($resource);
                    }
                    return;
                }

                Log::warning("OpenAiService: Model '{$model}' failed for stream with status {$response->status()}", [
                    'body' => $response->body()
                ]);
                $this->models = array_values(array_filter($this->models, fn($m) => $m !== $model));
            } catch (\Exception $e) {
                Log::warning("OpenAiService: Model '{$model}' stream threw exception: " . $e->getMessage());
                $this->models = array_values(array_filter($this->models, fn($m) => $m !== $model));
                $lastException = $e;
            }
        }

        throw new \Exception("All configured models failed to start stream. " . ($lastException ? $lastException->getMessage() : ''));
    }

    /**
     * Chat about a task with OpenAI, streaming the response.
     */
    public function chatStream(array $messages, array $taskDetails, callable $onChunk): void
    {
        $lang = $this->getLanguage();
        if (!$this->isConfigured()) {
            $mockReply = match ($lang) {
                'en' => "⚠️ **OpenAI API Key configuration is empty!**\n\nPlease configure the `OPENAI_API_KEY` field in the Laravel backend `.env` file (`taskflow-be/.env`) to start chatting with the AI Assistant.",
                'ja' => "⚠️ **OpenAI APIキーが設定されていません！**\n\nAIアシスタント và チャットを開始するには、Laravelバックエンドの`.env`ファイル（`taskflow-be/.env`）で`OPENAI_API_KEY`フィールドを設定してください。",
                default => "⚠️ **Cấu hình OpenAI API Key trống!**\n\nVui lòng cấu hình trường `OPENAI_API_KEY` trong file `.env` của backend Laravel (`taskflow-be/.env`) để bắt đầu trò chuyện với Trợ lý AI.",
            };
            $words = preg_split('/(\s+)/u', $mockReply, -1, PREG_SPLIT_DELIM_CAPTURE);
            foreach ($words as $word) {
                $onChunk(['content' => $word]);
                usleep(25000);
            }
            return;
        }

        $commentsText = '';
        if (!empty($taskDetails['comments'])) {
            $commentsText = match ($lang) {
                'en' => "Recent comments/discussions:\n",
                'ja' => "最近のコメント/ディスカッション:\n",
                default => "Bình luận/Thảo luận gần đây:\n",
            };
            foreach ($taskDetails['comments'] as $c) {
                $authorName = $c['user']['name'] ?? match ($lang) { 'en' => 'Anonymous', 'ja' => '匿名', default => 'Ẩn danh' };
                $content = strip_tags($c['content'] ?? '');
                $commentsText .= "- {$authorName}: {$content}\n";
            }
        }

        $taskTitleLabel = match ($lang) { 'en' => 'Task Title', 'ja' => 'タスクタイトル', default => 'Tiêu đề công việc' };
        $descLabel = match ($lang) { 'en' => 'Description', 'ja' => '説明', default => 'Mô tả' };
        $statusLabel = match ($lang) { 'en' => 'Status', 'ja' => 'ステータス', default => 'Trạng thái' };
        $priorityLabel = match ($lang) { 'en' => 'Priority', 'ja' => '優先度', default => 'Mức độ ưu tiên' };
        $assigneeLabel = match ($lang) { 'en' => 'Assignee', 'ja' => '担当者', default => 'Người thực hiện (Assignee)' };
        $projectLabel = match ($lang) { 'en' => 'Project', 'ja' => 'プロジェクト', default => 'Dự án' };
        $noDescLabel = match ($lang) { 'en' => 'No description', 'ja' => '説明なし', default => 'Không có mô tả' };
        $unassignedLabel = match ($lang) { 'en' => 'Unassigned', 'ja' => '未割り当て', default => 'Chưa phân công' };
        $unknownLabel = match ($lang) { 'en' => 'Unknown', 'ja' => '不明', default => 'Không rõ' };

        $systemPrompt = "You are an intelligent project management assistant for TaskFlow. "
            . "You help the user understand, manage, and execute their tasks.\n\n"
            . "Context of the current task:\n"
            . "---------------------------------\n"
            . "{$taskTitleLabel}: {$taskDetails['title']}\n"
            . "{$descLabel}: " . ($taskDetails['description'] ?? $noDescLabel) . "\n"
            . "{$statusLabel}: {$taskDetails['status']}\n"
            . "{$priorityLabel}: {$taskDetails['priority']}\n"
            . "{$assigneeLabel}: " . ($taskDetails['assignee']['name'] ?? $unassignedLabel) . "\n"
            . "{$projectLabel}: " . ($taskDetails['project']['name'] ?? $unknownLabel) . "\n"
            . "{$commentsText}"
            . "---------------------------------\n";

        if ($lang === 'en') {
            $systemPrompt .= "Please reply politely and professionally in English. Use markdown formatting to present clearly (lists, bolding, codeblocks if needed). "
                . "If the user asks you to draft a reply to a comment, write a professional and polite draft.";
        } elseif ($lang === 'ja') {
            $systemPrompt .= "丁寧かつプロフェッショナルに日本語で返答してください。マークダウン形式を使用して分かりやすく提示してください（リスト、太字、必要に応じてコードブロック）。ユーザーがコメントへの返信を依頼した場合は、プロフェッショナルで丁寧な下書きを作成してください。";
        } else {
            $systemPrompt .= "Hãy trả lời một cách lịch sự, chuyên nghiệp bằng tiếng Việt. Sử dụng markdown format để trình bày rõ ràng (list, in đậm, codeblock nếu cần). "
                . "Nếu người dùng nhờ soạn tin nhắn phản hồi bình luận, hãy viết nháp một phản hồi chuyên nghiệp và lịch sự.";
        }

        $guide = $this->getTrainingGuide();
        if ($guide !== '') {
            $systemPrompt .= "\n\nTaskFlow System Guidelines:\n" . $guide . "\n";
        }

        $payloadMessages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        $history = array_slice($messages, -10);
        foreach ($history as $msg) {
            $payloadMessages[] = [
                'role' => $msg['role'] === 'ai' ? 'assistant' : 'user',
                'content' => $msg['content'] ?? ''
            ];
        }

        $this->postChatCompletionStream([
            'messages' => $payloadMessages,
            'temperature' => 0.7,
        ], function ($chunk) use ($onChunk) {
            if (isset($chunk['done'])) {
                $onChunk(['done' => true]);
                return;
            }
            $delta = $chunk['data']['choices'][0]['delta'] ?? [];
            if (isset($delta['content'])) {
                $onChunk(['content' => $delta['content']]);
            }
        });
    }

    /**
     * Chat globally with tools supporting task/project creation, comments, timers, streaming response.
     */
    public function globalChatStream(array $messages, User $user, callable $onChunk): array
    {
        @set_time_limit(180);
        $lang = $this->getLanguage();
        $this->executedEvents = [];
        if (!$this->isConfigured()) {
            $mockRes = $this->handleMockGlobalChat($messages, $user);
            $mockReply = $mockRes['reply'];
            $words = preg_split('/(\s+)/u', $mockReply, -1, PREG_SPLIT_DELIM_CAPTURE);
            foreach ($words as $word) {
                $onChunk(['content' => $word]);
                usleep(25000);
            }
            return [
                'reply' => $mockReply,
                'actions' => [],
                'events' => []
            ];
        }

        $targetLangText = $this->getTargetLanguageName($lang);
        $exampleSuggestions = match ($lang) {
            'en' => "['Reopen task x', 'Stop timer for task y', 'Add a comment to task z']",
            'ja' => "['タスクxを再開する', 'タスクyのタイマーを停止', 'タスクzにコメントを追加']",
            default => "['Mở lại task x', 'Dừng timer cho task y', 'Thêm bình luận vào task z']",
        };

        $systemPrompt = "You are 'Brain' (or Max), a powerful global AI assistant for the TaskFlow project management platform. "
            . "You have FULL privileges to interact with the database on behalf of the current user: '{$user->name}' (ID: {$user->id}).\n\n"
            . "Available Capabilities / Guidelines:\n"
            . "1. You can list, create, and update projects or tasks/subtasks using the tools provided.\n"
            . "2. You can comment on tasks, track time (start/stop timer), list users, find stuck/overdue tasks.\n"
            . "3. Always check details before creating or updating. For example, if the user asks to create a task in 'project 1', call list_projects first to match the name 'project 1' to its exact project ID.\n"
            . "4. If the user asks to assign a task, search the users list using list_users first, passing the correct project_id if known. You MUST only assign tasks or suggest assignments to users who are members of that project.\n"
            . "5. When you modify or query tasks or projects successfully, summarize clearly what you did in {$targetLangText}. Use markdown. Avoid using raw database IDs (like task ID or project ID) in your final response text when referring to tasks or projects; instead, always refer to them by their actual names/titles (e.g., task 'Thiết kế UI' in project 'TaskFlow' instead of task ID 1 in project ID 2).\n"
            . "6. Output a list of follow-up buttons if relevant. To do this, always call the suggest_follow_ups tool to define interactive suggestions (e.g. {$exampleSuggestions}).\n"
            . "7. If the user asks to create a project but does not provide a name/title, DO NOT call create_project with a placeholder/dummy name. Instead, ask the user to provide the project name/title.\n"
            . "8. If the user asks to create a task but does not provide a title or doesn't specify which project it belongs to, DO NOT guess. Ask the user for the task title and/or to specify which project the task should belong to (you can also search for available projects first using list_projects).\n"
            . "9. If the user asks to start/stop a timer but does not specify a task ID or name, ask the user which task they want to run the timer for.\n"
            . "10. DO NOT output raw text-based function tags (such as (function=...<function> or <function=.../function>) in your response. If you want to call a tool, use the native tool calling mechanism. If you do not have enough information to call a tool, just ask the user for the information in plain text without referencing any function names or parameter templates.\n"
            . "11. When listing tasks (such as overdue or stuck tasks), DO NOT just report the task name and the project ID. Always use the project relation to mention the project name clearly (e.g., task 'A' belonging to project 'B') so the user has clear context.\n"
            . "12. When creating a project (create_project), ALWAYS include start_date and end_date if the user mentions any dates or time range. If the user mentions members by name, call list_users FIRST to look up their user IDs, then pass member_ids (array of integer user IDs) to create_project. Never skip dates or members if the user explicitly provided them. The creator is always added automatically as manager.\n"
            . "13. IMPORTANT PERFORMANCE RULE: Never call more than 10 tool functions in a single response turn. If you need to create many items (e.g. 30 tasks), batch them: create the first 10, then ask the user if they want to continue, or clearly state you are processing in batches. This prevents timeouts and ensures fast response times.\n"
            . "14. NEVER use markdown link syntax with command: protocol in your reply text. Do NOT write things like [Kiểm tra công việc](command:list_tasks(is_overdue=true)). If you want to suggest actions, ONLY use the suggest_follow_ups tool to register them as buttons. In your reply text, mention suggestions in plain text only (e.g. 'Bạn có muốn tôi kiểm tra công việc quá hạn không?').";

        $guide = $this->getTrainingGuide();
        if ($guide !== '') {
            $systemPrompt .= "\n\nTaskFlow System Guidelines:\n" . $guide . "\n";
        }

        $payloadMessages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        $history = array_slice($messages, -12);
        foreach ($history as $msg) {
            $cleanedContent = $this->stripAllFunctionTags($msg['content'] ?? '');
            if (isset($msg['tool_calls'])) {
                $payloadMessages[] = [
                    'role' => 'assistant',
                    'content' => $cleanedContent !== '' ? $cleanedContent : null,
                    'tool_calls' => $msg['tool_calls']
                ];
            } else {
                $payloadMessages[] = [
                    'role' => $msg['role'] === 'ai' ? 'assistant' : 'user',
                    'content' => $cleanedContent
                ];
            }
        }

        $tools = $this->getToolsSchema($lang);
        $suggestedFollowUps = [];
        $maxIterations = 5;

        for ($iteration = 0; $iteration < $maxIterations; $iteration++) {
            $hasToolCalls = false;
            $toolCallsBuffer = [];
            $textBuffer = '';

            $this->postChatCompletionStream([
                'messages'    => $payloadMessages,
                'tools'       => $tools,
                'tool_choice' => 'auto',
                'temperature' => 0.5,
                'max_tokens'  => 4096,
            ], function ($chunk) use (&$hasToolCalls, &$toolCallsBuffer, &$textBuffer, $onChunk) {
                if (isset($chunk['done'])) {
                    return;
                }
                $data = $chunk['data'] ?? [];
                $delta = $data['choices'][0]['delta'] ?? [];

                if (isset($delta['tool_calls'])) {
                    $hasToolCalls = true;
                    foreach ($delta['tool_calls'] as $tc) {
                        $idx = $tc['index'] ?? 0;
                        
                        $cleanTc = $tc;
                        unset($cleanTc['index']);

                        if (!isset($toolCallsBuffer[$idx])) {
                            $toolCallsBuffer[$idx] = $cleanTc;
                            if (!isset($toolCallsBuffer[$idx]['function'])) {
                                $toolCallsBuffer[$idx]['function'] = [];
                            }
                            if (!isset($toolCallsBuffer[$idx]['function']['name'])) {
                                $toolCallsBuffer[$idx]['function']['name'] = '';
                            }
                            if (!isset($toolCallsBuffer[$idx]['function']['arguments'])) {
                                $toolCallsBuffer[$idx]['function']['arguments'] = '';
                            }
                        } else {
                            foreach ($cleanTc as $k => $v) {
                                if ($k === 'function') {
                                    if (isset($v['name']) && $v['name'] !== '') {
                                        $toolCallsBuffer[$idx]['function']['name'] = $v['name'];
                                    }
                                    if (isset($v['arguments'])) {
                                        if (!isset($toolCallsBuffer[$idx]['function']['arguments'])) {
                                            $toolCallsBuffer[$idx]['function']['arguments'] = '';
                                        }
                                        $toolCallsBuffer[$idx]['function']['arguments'] .= $v['arguments'];
                                    }
                                } else {
                                    $toolCallsBuffer[$idx][$k] = $v;
                                }
                            }
                        }
                    }
                } elseif (isset($delta['content'])) {
                    $content = $delta['content'];
                    $textBuffer .= $content;
                    $onChunk(['content' => $content]);
                }
            });

            if ($hasToolCalls) {
                $toolCalls = array_values($toolCallsBuffer);
                $payloadMessages[] = [
                    'role'       => 'assistant',
                    'content'    => null,
                    'tool_calls' => $toolCalls
                ];

                foreach ($toolCalls as $toolCall) {
                    $toolId   = $toolCall['id'];
                    $toolName = $toolCall['function']['name'];
                    $toolArgs = json_decode($toolCall['function']['arguments'], true) ?: [];

                    if ($toolName === 'suggest_follow_ups') {
                        $suggestedFollowUps = $toolArgs['suggestions'] ?? [];
                        $toolOutput = ['status' => 'success', 'message' => 'Follow ups registered'];
                    } else {
                        $onChunk(['status' => 'executing_tool', 'tool' => $toolName]);
                        $toolOutput = $this->executeTool($toolName, $toolArgs, $user, $lang);
                    }

                    $payloadMessages[] = [
                        'role'        => 'tool',
                        'tool_call_id'=> $toolId,
                        'name'        => $toolName,
                        'content'     => json_encode($toolOutput)
                    ];
                }

                $allSuggestFollowUps = array_reduce(
                    $toolCalls,
                    fn($carry, $tc) => $carry && ($tc['function']['name'] === 'suggest_follow_ups'),
                    true
                );
                if ($allSuggestFollowUps) {
                    break;
                }

                continue;
            } else {
                return [
                    'reply' => $this->cleanRemainingFunctionTags($textBuffer, $lang),
                    'actions' => $suggestedFollowUps,
                    'events' => $this->executedEvents
                ];
            }
        }

        return [
            'reply' => '',
            'actions' => $suggestedFollowUps,
            'events' => $this->executedEvents
        ];
    }
    /**
     * Parse text-based function calls from content string.
     */
    protected function parseTextToolCalls(string $content): array
    {
        $toolCalls = [];
        
        // Match (function=name>json_object
        if (preg_match_all('/\(function=([a-zA-Z0-9_-]+)>(.*?(\{(?:[^{}]+|(?R))*\}))(?:<function>)?/s', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $args = json_decode(trim($match[2]), true) ?: [];
                $toolCalls[] = [
                    'raw' => $match[0],
                    'name' => $match[1],
                    'arguments' => $args
                ];
            }
        }
        
        // Match <function=name>json_object
        if (preg_match_all('/<function=([a-zA-Z0-9_-]+)>(.*?(\{(?:[^{}]+|(?R))*\}))(?:<\/function>)?/s', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $args = json_decode(trim($match[2]), true) ?: [];
                $toolCalls[] = [
                    'raw' => $match[0],
                    'name' => $match[1],
                    'arguments' => $args
                ];
            }
        }
        
        return $toolCalls;
    }

    /**
     * Detect if a string value is an AI generated placeholder.
     */
    protected function isPlaceholder(?string $val): bool
    {
        if (empty($val)) return true;
        $val = mb_strtolower(trim($val), 'UTF-8');
        $placeholders = [
            'project_name', 'task_title', 'placeholder', 'your_project_name', 
            'your_task_title', 'tên_dự_án', 'tên_công_việc', 'dummy',
            'project-name', 'task-title', 'tên công việc', 'tên dự án',
            'dự án mới', 'công việc mới', 'new project', 'new task',
            'dự án_mới', 'công_việc_mới', 'tên dự án mới', 'tên công việc mới'
        ];
        foreach ($placeholders as $ph) {
            if (strpos($val, $ph) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * Clean remaining function tags by converting them to user-friendly titles.
     */
    protected function cleanRemainingFunctionTags(string $content, string $lang = 'vi'): string
    {
        $isEn = ($lang !== 'vi'); // Both en and ja use English for tag cleaning
        
        $friendlyNames = [
            'list_projects' => $isEn ? 'List Projects' : 'Xem danh sách dự án',
            'list_tasks' => $isEn ? 'List Tasks' : 'Xem danh sách công việc',
            'get_running_timer' => $isEn ? 'Check Timer' : 'Kiểm tra bộ đếm thời gian',
            'create_project' => $isEn ? 'Create Project' : 'Tạo dự án',
            'create_task' => $isEn ? 'Create Task' : 'Tạo công việc',
            'update_task' => $isEn ? 'Update Task' : 'Cập nhật công việc',
            'start_timer' => $isEn ? 'Start Timer' : 'Bắt đầu ghi nhận thời gian',
            'stop_timer' => $isEn ? 'Stop Timer' : 'Dừng ghi nhận thời gian',
            'add_comment' => $isEn ? 'Add Comment' : 'Thêm bình luận',
            'list_users' => $isEn ? 'List Users' : 'Xem danh sách thành viên',
            'get_stuck_tasks' => $isEn ? 'Find Stuck Tasks' : 'Tìm công việc bị trì hoãn',
            'suggest_follow_ups' => $isEn ? 'Suggest Actions' : 'Gợi ý hành động'
        ];

        $pattern = '/[<(]function=([a-zA-Z0-9_-]+)>(?:<\/(?:function)?>)?/i';
        
        return preg_replace_callback($pattern, function ($matches) use ($friendlyNames) {
            $name = $matches[1];
            if (isset($friendlyNames[$name])) {
                return '"' . $friendlyNames[$name] . '"';
            }
            return '"' . str_replace('_', ' ', $name) . '"';
        }, $content);
    }

    /**
     * Completely strip all function tags (and their arguments) from text.
     */
    protected function stripAllFunctionTags(string $content): string
    {
        // 1. Remove tags with JSON args
        $patternParens = '/\(function=[a-zA-Z0-9_-]+>.*?(\{(?:[^{}]+|(?R))*\})(?:<function>)?/s';
        $patternAngle = '/<function=[a-zA-Z0-9_-]+>.*?(\{(?:[^{}]+|(?R))*\})(?:<\/function>)?/s';
        
        $content = preg_replace($patternParens, '', $content);
        $content = preg_replace($patternAngle, '', $content);
        
        // 2. Remove remaining empty function tags
        $patternEmpty = '/[<(]function=[a-zA-Z0-9_-]+>(?:<\/(?:function)?>)?/i';
        $content = preg_replace($patternEmpty, '', $content);
        
        return trim($content);
    }
}
