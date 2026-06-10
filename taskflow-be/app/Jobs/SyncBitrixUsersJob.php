<?php

namespace App\Jobs;

use App\Services\BitrixService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncBitrixUsersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $accessToken;

    /**
     * Create a new job instance.
     */
    public function __construct(string $accessToken)
    {
        $this->accessToken = $accessToken;
    }

    /**
     * Execute the job.
     */
    public function handle(BitrixService $bitrixService): void
    {
        try {
            $bitrixService->setAccessToken($this->accessToken)->syncUsers();
        } catch (\Exception $e) {
            Log::error('Queued Bitrix user sync failed: ' . $e->getMessage());
        }
    }
}
