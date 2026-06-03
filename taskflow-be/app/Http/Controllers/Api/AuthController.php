<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\BitrixService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    protected BitrixService $bitrix;

    public function __construct(BitrixService $bitrix)
    {
        $this->bitrix = $bitrix;
    }

    /**
     * Step 1: Redirect user to Bitrix OAuth2 authorization page.
     */
    public function redirect(Request $request)
    {
        $origin = $request->query('origin');
        if (!$origin) {
            $referer = $request->headers->get('referer');
            if ($referer) {
                $parsed = parse_url($referer);
                if (isset($parsed['scheme']) && isset($parsed['host'])) {
                    $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
                    $origin = $parsed['scheme'] . '://' . $parsed['host'] . $port;
                }
            }
        }
        if (!$origin) {
            $host = $request->getHost();
            $origin = "http://{$host}:3000";
        }

        $authUrl = config('bitrix.url') . '/oauth/authorize/?' . http_build_query([
            'client_id' => config('bitrix.client_id'),
            'response_type' => 'code',
            'state' => $origin,
        ]);

        return redirect()->away($authUrl);
    }

    /**
     * Bitrix Local App Handler / OAuth2 Callback.
     *
     * Supports multiple flows:
     * A) GET ?code=xxx → exchange for token via oauth.bitrix.info
     * B) POST AUTH_ID from Bitrix local app
     * C) GET with AJAX from embedded JS page
     */
    public function callback(Request $request)
    {
        // === Flow A: Authorization Code → exchange via oauth.bitrix.info or local ===
        if ($request->has('code')) {
            return $this->handleAuthorizationCode($request);
        }

        // === Flow B: POST from Bitrix local app handler (AUTH_ID) ===
        $authId = $request->input('AUTH_ID') ?? $request->input('auth_id');
        if ($authId) {
            return $this->handleLocalApp($request);
        }

        // === Flow C: Show handler page (Bitrix embeds this as iframe) ===
        return $this->showHandlerPage();
    }

    /**
     * Show the Bitrix handler page that extracts auth params from JS.
     * Bitrix loads this page in an iframe and passes placement info.
     */
    private function showHandlerPage()
    {
        $html = <<<'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>TaskFlow - Bitrix Auth</title>
    <script src="https://api.bitrix24.com/api/v1/"></script>
</head>
<body>
    <div id="status">Authenticating with Bitrix24...</div>
    <script>
        // BX24 JS SDK – get auth info from the iframe context
        BX24.init(function() {
            var auth = BX24.getAuth();

            if (auth && auth.access_token) {
                document.getElementById('status').innerText = 'Got token, logging in...';

                // Send auth to our Laravel backend
                fetch('/api/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        AUTH_ID: auth.access_token,
                        REFRESH_ID: auth.refresh_token,
                        AUTH_EXPIRES: auth.expires_in,
                        DOMAIN: auth.domain,
                        member_id: auth.member_id || ''
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('status').innerText = 'Welcome, ' + data.user.name + '!';
                        // Store token and redirect to app
                        if (window.parent !== window) {
                            window.parent.postMessage({
                                type: 'TASKFLOW_AUTH',
                                token: data.token,
                                user: data.user
                            }, '*');
                        } else {
                            localStorage.setItem('taskflow_token', data.token);
                            window.location.href = '/';
                        }
                    } else {
                        document.getElementById('status').innerText = 'Auth failed: ' + data.message;
                    }
                })
                .catch(err => {
                    document.getElementById('status').innerText = 'Error: ' + err.message;
                });
            } else {
                document.getElementById('status').innerText = 'No auth data from Bitrix. Please open this app from Bitrix24.';
            }
        });
    </script>
</body>
</html>
HTML;

        return response($html)->header('Content-Type', 'text/html');
    }

    /**
     * Handle authorization code – try exchange via oauth.bitrix.info (cloud)
     * or via local Bitrix server.
     */
    private function handleAuthorizationCode(Request $request)
    {
        $code = $request->input('code');
        
        $bitrixUrl = config('bitrix.url', 'https://bitrix.esuhai.org');
        $parsedUrl = parse_url($bitrixUrl);
        $defaultDomain = $parsedUrl['host'] ?? 'oauth.bitrix.info';
        
        $serverDomain = $request->input('server_domain', $defaultDomain);
        $domain = $request->input('domain');
        $memberId = $request->input('member_id');

        // Try oauth.bitrix.info first (standard Bitrix24)
        $tokenUrl = "https://{$serverDomain}/oauth/token/";

        $response = Http::get($tokenUrl, [
            'grant_type' => 'authorization_code',
            'client_id' => config('bitrix.client_id'),
            'client_secret' => config('bitrix.client_secret'),
            'code' => $code,
        ]);

        $data = $response->json();
        Log::info('Bitrix OAuth token exchange', [
            'url' => $tokenUrl,
            'status' => $response->status(),
            'data' => $data,
        ]);

        if ($data && isset($data['access_token'])) {
            $state = $request->input('state');
            if (!$state) {
                $origins = explode(',', env('FRONTEND_URL', 'http://localhost:3000'));
                $state = $origins[0];
            }

            return $this->createUserAndToken(
                accessToken: $data['access_token'],
                refreshToken: $data['refresh_token'] ?? null,
                expiresIn: $data['expires_in'] ?? 3600,
                domain: $data['domain'] ?? $domain,
                memberId: $data['member_id'] ?? $memberId,
                redirectUrl: $state
            );
        }

        // Fallback: return error with debug info
        return response()->json([
            'success' => false,
            'message' => 'Failed to exchange code for token',
            'token_url' => $tokenUrl,
            'bitrix_response' => $data,
            'hint' => 'For on-premise Bitrix, try opening the app from Bitrix24 UI instead.',
        ], 401);
    }

    /**
     * Handle Bitrix local app POST (AUTH_ID directly).
     */
    private function handleLocalApp(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        return $this->createUserAndToken(
            accessToken: $request->input('AUTH_ID') ?? $request->input('auth_id'),
            refreshToken: $request->input('REFRESH_ID') ?? $request->input('refresh_id'),
            expiresIn: (int) ($request->input('AUTH_EXPIRES') ?? $request->input('auth_expires') ?? 3600),
            domain: $request->input('DOMAIN') ?? $request->input('domain'),
            memberId: $request->input('member_id'),
        );
    }

    /**
     * Core: validate access_token → create/update User → Sanctum token.
     */
    private function createUserAndToken(
        string $accessToken,
        ?string $refreshToken,
        int $expiresIn,
        ?string $domain,
        ?string $memberId,
        ?string $redirectUrl = null
    ): \Symfony\Component\HttpFoundation\Response {
        $bitrixUser = $this->bitrix->getCurrentUser($accessToken);

        if (!$bitrixUser) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot validate Bitrix access token',
            ], 401);
        }

        $existingUser = User::find($bitrixUser['ID']);

        $role = 'employee';
        if ((int)$bitrixUser['ID'] === 632) {
            $role = 'admin';
        } else if ($existingUser && $existingUser->role === 'admin') {
            $role = 'admin';
        } else if (str_contains($bitrixUser['EMAIL'] ?? '', 'admin') || ($bitrixUser['EMAIL'] ?? '') === 'sa@esuhai.com') {
            $role = 'admin';
        } else {
            try {
                $departments = $this->bitrix->getDepartments();
                foreach ($departments as $dept) {
                    $headId = $dept['UF_HEAD'] ?? null;
                    if ($headId && (int)$headId === (int)$bitrixUser['ID']) {
                        $role = 'manager';
                        break;
                    }
                }
            } catch (\Exception $e) {
                $role = $existingUser ? ($existingUser->role ?? 'employee') : 'employee';
            }
        }

        $user = User::updateOrCreate(
            ['id' => $bitrixUser['ID']],
            [
                'bitrix_id' => $bitrixUser['ID'],
                'name' => trim(($bitrixUser['LAST_NAME'] ?? '') . ' ' . ($bitrixUser['NAME'] ?? '')),
                'first_name' => $bitrixUser['NAME'] ?? '',
                'last_name' => $bitrixUser['LAST_NAME'] ?? '',
                'email' => $bitrixUser['EMAIL'] ?? '',
                'phone' => $bitrixUser['PERSONAL_MOBILE'] ?? $bitrixUser['PERSONAL_PHONE'] ?? '',
                'photo' => $bitrixUser['PERSONAL_PHOTO'] ?? null,
                'department_ids' => $bitrixUser['UF_DEPARTMENT'] ?? [],
                'work_position' => $bitrixUser['WORK_POSITION'] ?? '',
                'active' => in_array($bitrixUser['ACTIVE'] ?? 'Y', ['Y', 1, '1', true], true),
                'bitrix_access_token' => $accessToken,
                'bitrix_refresh_token' => $refreshToken,
                'bitrix_token_expires' => now()->addSeconds($expiresIn),
                'bitrix_domain' => $domain,
                'bitrix_member_id' => $memberId,
                'role' => $role,
            ]
        );

        $user->tokens()->delete();
        $sanctumToken = $user->createToken('taskflow-session', ['*'], now()->addDays(30));

        // Sync all users in the background/inline to ensure assignee/member lists are populated
        try {
            $this->bitrix->setAccessToken($accessToken)->syncUsers();
        } catch (\Exception $e) {
            Log::error('Bitrix user sync on login failed: ' . $e->getMessage());
        }

        if ($redirectUrl) {
            $redirectUrl = rtrim($redirectUrl, '/');
            return redirect()->away($redirectUrl . '/?token=' . $sanctumToken->plainTextToken);
        }

        return response()->json([
            'success' => true,
            'token' => $sanctumToken->plainTextToken,
            'user' => [
                'id' => $user->id,
                'bitrix_id' => $user->bitrix_id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo' => $user->photo,
                'department_ids' => $user->department_ids,
                'work_position' => $user->work_position,
                'role' => $user->role,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'bitrix_id' => $user->bitrix_id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo' => $user->photo,
                'department_ids' => $user->department_ids,
                'work_position' => $user->work_position,
                'role' => $user->role,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['success' => true, 'message' => 'Logged out']);
    }

    /**
     * GET /api/users
     * List all local users from the DB (for assignee dropdowns, member lists, etc.)
     */
    public function listUsers(Request $request): JsonResponse
    {
        $search = trim($request->input('search'));
        $search = preg_replace('/\s+/', ' ', $search);

        $query = User::query()->orderBy('name');

        // Only return active users
        $query->where('active', true);

        $currentUser = $request->user();
        if ($currentUser) {
            if ($currentUser->role === 'employee') {
                $query->where('id', $currentUser->id);
            } elseif ($currentUser->role === 'manager') {
                $managedDeptIds = [];
                try {
                    $departments = $this->bitrix->getDepartments();
                    foreach ($departments as $dept) {
                        $headId = $dept['UF_HEAD'] ?? null;
                        if ($headId && (int)$headId === (int)$currentUser->id) {
                            $managedDeptIds[] = (int)$dept['ID'];
                        }
                    }

                    // Recursively get sub-departments
                    if (!empty($managedDeptIds)) {
                        $allManagedIds = $managedDeptIds;
                        $added = true;
                        while ($added) {
                            $added = false;
                            foreach ($departments as $dept) {
                                $deptId = (int)$dept['ID'];
                                $parentId = isset($dept['PARENT']) ? (int)$dept['PARENT'] : null;
                                if ($parentId && in_array($parentId, $allManagedIds, true) && !in_array($deptId, $allManagedIds, true)) {
                                    $allManagedIds[] = $deptId;
                                    $added = true;
                                }
                            }
                        }
                        $managedDeptIds = $allManagedIds;
                    }
                } catch (\Exception $e) {
                    $managedDeptIds = $currentUser->department_ids ?? [];
                }

                $query->where(function ($q) use ($currentUser, $managedDeptIds) {
                    $q->where('id', $currentUser->id);
                    foreach ($managedDeptIds as $deptId) {
                        $q->orWhereJsonContains('department_ids', (int)$deptId);
                    }
                });
            }
        }

        if (!empty($search)) {
            $likePattern = '%' . str_replace(' ', '%', $search) . '%';
            $query->where(function ($q) use ($likePattern) {
                $q->whereRaw('TRIM(name) LIKE ?', [$likePattern])
                  ->orWhereRaw('TRIM(email) LIKE ?', [$likePattern]);
            });
        }

        $users = $query->get(['id', 'name', 'email', 'photo', 'work_position', 'role', 'department_ids']);

        // Auto-sync fallback: If the database is missing managed users, trigger an on-the-fly sync.
        // We only trigger if the user count is <= 1 AND there is no search query (to avoid syncing on empty search results).
        if ($users->count() <= 1 && empty($search) && $currentUser && in_array($currentUser->role, ['manager', 'admin'])) {
            try {
                $token = $this->bitrix->ensureValidToken($currentUser);
                if ($token) {
                    $this->bitrix->syncUsers();
                    // Re-run the query
                    $users = $query->get(['id', 'name', 'email', 'photo', 'work_position', 'role', 'department_ids']);
                }
            } catch (\Exception $e) {
                Log::error('Auto-sync in listUsers failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * PUT /api/auth/settings
     * Save user preferences (theme, timezone, language, workspace_name, notification_settings)
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'theme' => 'sometimes|string|in:light,dark,system',
            'timezone' => 'sometimes|string|max:255',
            'language' => 'sometimes|string|in:vi,en,ja',
            'workspace_name' => 'sometimes|string|max:255',
            'notification_settings' => 'sometimes|array',
        ]);

        $user->update($request->only([
            'theme',
            'timezone',
            'language',
            'workspace_name',
            'notification_settings',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'theme' => $user->theme,
                'timezone' => $user->timezone,
                'language' => $user->language,
                'workspace_name' => $user->workspace_name,
                'notification_settings' => $user->notification_settings,
            ]
        ]);
    }
}
