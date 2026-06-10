<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Task;
use Illuminate\Support\Facades\Log;

class ProcessRecurringTasks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tasks:process-recurring';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process recurring tasks and spawn new instances';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting processing of recurring tasks...');
        Log::info('Artisan Command: tasks:process-recurring started.');

        $now = now();
        $tasks = Task::where('is_recurring', true)
            ->whereNotNull('recurring_next_trigger')
            ->where('recurring_next_trigger', '<=', $now)
            ->get();

        $count = $tasks->count();
        $this->info("Found {$count} recurring tasks due to trigger.");
        Log::info("Found {$count} recurring tasks due to trigger.");

        $successCount = 0;
        $failCount = 0;

        foreach ($tasks as $task) {
            try {
                $this->comment("Processing task #{$task->id}: '{$task->title}' (Next trigger: {$task->recurring_next_trigger})");
                $clone = $task->processRecurrence();
                if ($clone) {
                    $this->info("Successfully created clone task #{$clone->id} for parent task #{$task->id}");
                    Log::info("Recurring task #{$task->id} cloned successfully to task #{$clone->id}");
                    $successCount++;
                } else {
                    $this->error("Failed to process recurrence for task #{$task->id}: processRecurrence returned null");
                    Log::error("Recurring task #{$task->id} processRecurrence returned null");
                    $failCount++;
                }
            } catch (\Exception $e) {
                $this->error("Error processing task #{$task->id}: " . $e->getMessage());
                Log::error("Error processing recurring task #{$task->id}: " . $e->getMessage(), [
                    'exception' => $e
                ]);
                $failCount++;
            }
        }

        $this->info("Finished processing. Success: {$successCount}, Failed: {$failCount}.");
        Log::info("Artisan Command: tasks:process-recurring finished. Success: {$successCount}, Failed: {$failCount}.");

        return Command::SUCCESS;
    }
}
