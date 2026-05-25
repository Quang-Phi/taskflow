<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatusTemplate extends Model
{
    protected $fillable = [
        'name',
        'statuses',
        'created_by',
    ];

    protected $casts = [
        'statuses' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
