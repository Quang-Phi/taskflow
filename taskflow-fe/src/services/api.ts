import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

const getApiBaseUrl = (): string => {
  let url = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
};
const API_BASE_URL = getApiBaseUrl();

const triggerSilentRefresh = (): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.id = 'taskflow-silent-refresh-iframe';

    const backendUrl = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    iframe.src = `${backendUrl}/auth/redirect?origin=${encodeURIComponent(window.location.origin)}`;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Silent refresh timeout'));
    }, 12000);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'SILENT_REFRESH_SUCCESS' && event.data.token) {
        cleanup();
        resolve(event.data.token);
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
  });
};

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: any[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor: attach Sanctum Bearer token and current language
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('taskflow_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const lang = localStorage.getItem('taskflow_lang') || 'vi';
        if (config.headers) {
          config.headers['X-Language'] = lang;
          config.headers['ngrok-skip-browser-warning'] = 'true';
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401 and capture server time offset
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (response.data && response.data.server_time) {
          const serverTimeStr = response.data.server_time;
          const serverTimeMs = new Date(serverTimeStr).getTime();
          if (!isNaN(serverTimeMs)) {
            const offset = serverTimeMs - Date.now();
            localStorage.setItem('taskflow_server_time_offset', String(offset));
          }
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          const isBitrixError = originalRequest.url?.includes('/bitrix/') || 
                                error.response?.data?.message?.toLowerCase().includes('bitrix');
          
          if (isBitrixError) {
            return Promise.reject(error);
          }

          // If running standalone (not embedded in an iframe), do not attempt silent refresh via iframe (it will be blocked by X-Frame-Options sameorigin)
          if (window.self === window.top) {
            localStorage.removeItem('taskflow_token');
            message.error('Phiên đăng nhập đã hết hạn. Đang chuyển hướng...', 2);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const backendUrl = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
            const publicUrl = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
            window.location.href = `${backendUrl}/auth/redirect?origin=${encodeURIComponent(window.location.origin + publicUrl)}`;
            return Promise.reject(error);
          }

          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject, config: originalRequest });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            console.warn('[API] 401 Unauthorized. Starting silent token refresh via iframe...');
            const newToken = await triggerSilentRefresh();
            console.info('[API] Silent token refresh succeeded!');

            localStorage.setItem('taskflow_token', newToken);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }

            this.processQueue(null, newToken);
            this.isRefreshing = false;

            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('[API] Silent refresh failed or timed out:', refreshError);
            this.processQueue(refreshError, null);
            this.isRefreshing = false;

            localStorage.removeItem('taskflow_token');

            // Notify user via Ant Design message before redirecting
            message.error('Phiên đăng nhập đã hết hạn. Đang tải lại trang...', 2);

            await new Promise((resolve) => setTimeout(resolve, 1500));
            const backendUrl = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
            const publicUrl = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
            window.location.href = `${backendUrl}/auth/redirect?origin=${encodeURIComponent(window.location.origin + publicUrl)}`;

            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );

    // Deduplicate concurrent GET requests
    const originalGet = this.client.get.bind(this.client);
    const getPromises = new Map<string, Promise<any>>();
    this.client.get = ((url: string, config?: any) => {
      const key = JSON.stringify({ url, params: config?.params });
      if (getPromises.has(key)) {
        return getPromises.get(key)!;
      }
      const promise = originalGet(url, config).then(
        (res) => {
          getPromises.delete(key);
          return res;
        },
        (err) => {
          getPromises.delete(key);
          throw err;
        }
      );
      getPromises.set(key, promise);
      return promise;
    }) as any;
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        if (prom.config.headers) {
          prom.config.headers.Authorization = `Bearer ${token}`;
        }
        prom.resolve(this.client(prom.config));
      }
    });
    this.failedQueue = [];
  }

  // === AUTH (SSO via Bitrix cookies) ===
  async loginWithBitrixSession(cookies: string) {
    const res = await this.client.post('/auth/login', { bitrix_cookies: cookies });
    if (res.data.token) {
      localStorage.setItem('taskflow_token', res.data.token);
    }
    return res.data;
  }

  async getMe() {
    const res = await this.client.get('/auth/me');
    return res.data.user;
  }

  async updateSettings(data: {
    theme?: string;
    timezone?: string;
    language?: string;
    workspace_name?: string;
    notification_settings?: Record<string, boolean>;
  }) {
    const res = await this.client.put('/auth/settings', data);
    return res.data;
  }

  async getDashboardStats() {
    const res = await this.client.get('/dashboard/stats');
    return res.data;
  }

  async getAnalyticsData(params?: { project_id?: string | number }) {
    const res = await this.client.get('/analytics/data', { params });
    return res.data;
  }

  // === EVALUATIONS ===
  async getEvaluations(params?: { period?: string; status?: string; employee_id?: number | string }) {
    const res = await this.client.get('/evaluations', { params });
    return res.data;
  }

  async generateEvaluations(period: string) {
    const res = await this.client.post('/evaluations/generate', { period });
    return res.data;
  }

  async getEvaluation(id: number) {
    const res = await this.client.get(`/evaluations/${id}`);
    return res.data;
  }

  async updateEvaluation(id: number, data: {
    comment?: string;
    publish?: boolean;
  }) {
    const res = await this.client.put(`/evaluations/${id}`, data);
    return res.data;
  }

  // === NOTIFICATIONS ===
  async getNotifications(params?: { tab?: string; page?: number; per_page?: number }) {
    const res = await this.client.get('/notifications', { params });
    return res.data;
  }

  async markNotificationsRead(ids?: number[]) {
    const res = await this.client.post('/notifications/read', { ids });
    return res.data;
  }

  async getUnreadCount() {
    const res = await this.client.get('/notifications/unread-count');
    return res.data;
  }

  // === LOCAL USERS (from DB) ===
  async getLocalUsers(params?: { search?: string }) {
    const res = await this.client.get('/users', { params });
    return res.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      localStorage.removeItem('taskflow_token');
    }
  }

  // === BITRIX PROXY ===
  async getUsers(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    role?: string; 
    department_id?: string | number; 
    refresh?: boolean; 
    active?: boolean;
  }) {
    const res = await this.client.get('/bitrix/users', { params });
    return res.data;
  }

  async getUser(id: number) {
    const res = await this.client.get(`/bitrix/users/${id}`);
    return res.data;
  }

  async getDepartments() {
    const res = await this.client.get('/bitrix/departments');
    return res.data;
  }

  async updateUser(id: number, data: { role?: 'admin' | 'manager' | 'employee'; department_ids?: number[] }) {
    const res = await this.client.put(`/bitrix/users/${id}`, data);
    return res.data;
  }

  // === PROJECTS ===
  async getProjects(params?: { search?: string; status?: string; page?: number; per_page?: number }) {
    const res = await this.client.get('/projects', { params });
    return res.data;
  }

  async createProject(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string | null;
    priority?: 'low' | 'medium' | 'high';
    status?: 'planning' | 'active' | 'completed' | 'on_hold';
    start_date?: string;
    end_date?: string;
    member_ids?: (string | number)[];
  }) {
    const res = await this.client.post('/projects', data);
    return res.data;
  }

  async getProject(id: string | number) {
    const res = await this.client.get(`/projects/${id}`);
    return res.data;
  }

  async getProjectTimeEntries(id: string | number) {
    const res = await this.client.get(`/projects/${id}/time-entries`);
    return res.data;
  }

  async updateProject(id: string | number, data: any) {
    const res = await this.client.put(`/projects/${id}`, data);
    return res.data;
  }

  async deleteProject(id: string | number) {
    const res = await this.client.delete(`/projects/${id}`);
    return res.data;
  }

  async addProjectMember(projectId: string | number, data: { user_id?: string | number; user_ids?: (string | number)[]; role?: 'manager' | 'member' }) {
    const res = await this.client.post(`/projects/${projectId}/members`, data);
    return res.data;
  }

  async removeProjectMember(projectId: string | number, userId: string | number) {
    const res = await this.client.delete(`/projects/${projectId}/members/${userId}`);
    return res.data;
  }

  async updateProjectStatuses(id: string | number, statuses: any[], status_mappings?: Record<string, string>) {
    const res = await this.client.put(`/projects/${id}/statuses`, { statuses, status_mappings });
    return res.data;
  }

  async getStatusTemplates() {
    const res = await this.client.get('/status-templates');
    return res.data;
  }

  async createStatusTemplate(name: string, statuses: any[]) {
    const res = await this.client.post('/status-templates', { name, statuses });
    return res.data;
  }

  async deleteStatusTemplate(id: string | number) {
    const res = await this.client.delete(`/status-templates/${id}`);
    return res.data;
  }

  // === WORKFLOW ===
  async getWorkflow(projectId: string | number) {
    const res = await this.client.get(`/projects/${projectId}/workflow`);
    return res.data;
  }

  async updateWorkflow(projectId: string | number, workflow: {
    mode: 'unrestricted' | 'restricted';
    transitions: Array<{
      id: string;
      name: string;
      from: string;
      to: string;
      allowed_roles: string[];
    }>;
    global_transitions?: Array<{
      id: string;
      name: string;
      to: string;
      allowed_roles: string[];
    }>;
  }) {
    const res = await this.client.put(`/projects/${projectId}/workflow`, workflow);
    return res.data;
  }

  async getAvailableTransitions(projectId: string | number, statusId: string) {
    const res = await this.client.get(`/projects/${projectId}/transitions/${statusId}`);
    return res.data;
  }

  async getTasks(projectIdOrParams?: string | number | { project_id?: string | number; assignee_id?: string | number }) {
    let params: any = {};
    if (projectIdOrParams) {
      if (typeof projectIdOrParams === 'object') {
        params = projectIdOrParams;
      } else {
        params.project_id = projectIdOrParams;
      }
    }
    const res = await this.client.get('/tasks', { params });
    return res.data;
  }

  async createTask(data: {
    project_id: string | number;
    title: string;
    description?: string;
    status?: string;
    priority?: 'low' | 'medium' | 'high';
    assignee_id?: string | number;
    estimated_hours?: number;
    actual_hours?: number;
    start_date?: string;
    due_date?: string;
    parent_task_id?: string | number;
  }) {
    const res = await this.client.post('/tasks', data);
    return res.data;
  }

  async getTask(id: string | number) {
    const res = await this.client.get(`/tasks/${id}`);
    return res.data;
  }

  async updateTask(id: string | number, data: any) {
    const res = await this.client.put(`/tasks/${id}`, data);
    return res.data;
  }

  async deleteTask(id: string | number) {
    const res = await this.client.delete(`/tasks/${id}`);
    return res.data;
  }

  async updateTaskStatus(id: string | number, data: { status: string; position?: number }) {
    const res = await this.client.put(`/tasks/${id}/status`, data);
    return res.data;
  }

  async createTaskComment(taskId: string | number, comment: string, attachment?: File, parentId?: string | number) {
    const formData = new FormData();
    formData.append('comment', comment);
    if (attachment) {
      formData.append('attachment', attachment);
    }
    if (parentId !== undefined && parentId !== null) {
      formData.append('parent_id', String(parentId));
    }
    const res = await this.client.post(`/tasks/${taskId}/comments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }
  async reactToComment(commentId: string | number, reaction: string) {
    const res = await this.client.post(`/comments/${commentId}/react`, { reaction });
    return res.data;
  }

  async getTaskComments(taskId: string | number, page = 1, perPage = 15) {
    const res = await this.client.get(`/tasks/${taskId}/comments`, { params: { page, per_page: perPage } });
    return res.data;
  }

  async getTaskActivities(taskId: string | number, page = 1, perPage = 20) {
    const res = await this.client.get(`/tasks/${taskId}/activities`, { params: { page, per_page: perPage } });
    return res.data;
  }

  async toggleWatchTask(taskId: string | number) {
    const res = await this.client.post(`/tasks/${taskId}/watch`);
    return res.data;
  }

  async startTimer(taskId: string | number) {
    const res = await this.client.post(`/tasks/${taskId}/timer/start`);
    return res.data;
  }

  async stopTimer(taskId: string | number) {
    const res = await this.client.post(`/tasks/${taskId}/timer/stop`);
    return res.data;
  }

  async addManualTime(taskId: string | number, data: { duration: number; description?: string; started_at?: string }) {
    const res = await this.client.post(`/tasks/${taskId}/time-entries`, data);
    return res.data;
  }

  async deleteTimeEntry(id: string | number) {
    const res = await this.client.delete(`/time-entries/${id}`);
    return res.data;
  }

  async getRunningTimer() {
    const res = await this.client.get('/me/timer/running');
    return res.data;
  }

  async getTodayTimeEntries() {
    const res = await this.client.get('/me/time-entries/today');
    return res.data;
  }

  async getTimeEntriesList(params?: { user_id?: string | number; start_date?: string; end_date?: string; view_all?: boolean }) {
    const res = await this.client.get('/time-entries', { params });
    return res.data;
  }

  // === CUSTOM FIELDS ===
  async getProjectCustomFields(projectId: string | number) {
    const res = await this.client.get(`/projects/${projectId}/custom-fields`);
    return res.data;
  }

  async createCustomField(projectId: string | number, data: { name: string; type: string; options?: string[] }) {
    const res = await this.client.post(`/projects/${projectId}/custom-fields`, data);
    return res.data;
  }

  async deleteCustomField(id: string | number) {
    const res = await this.client.delete(`/custom-fields/${id}`);
    return res.data;
  }

  async updateCustomFieldValues(taskId: string | number, fieldValues: Record<string | number, any>) {
    const res = await this.client.post(`/tasks/${taskId}/custom-field-values`, { field_values: fieldValues });
    return res.data;
  }

  // === CHECKLISTS ===
  async createChecklist(taskId: string | number, name: string) {
    const res = await this.client.post(`/tasks/${taskId}/checklists`, { name });
    return res.data;
  }

  async updateChecklist(id: string | number, name: string) {
    const res = await this.client.put(`/checklists/${id}`, { name });
    return res.data;
  }

  async deleteChecklist(id: string | number) {
    const res = await this.client.delete(`/checklists/${id}`);
    return res.data;
  }

  async createChecklistItem(checklistId: string | number, name: string, assigneeId?: string | number) {
    const res = await this.client.post(`/checklists/${checklistId}/items`, { name, assignee_id: assigneeId });
    return res.data;
  }

  async updateChecklistItem(id: string | number, data: { name?: string; is_checked?: boolean; assignee_id?: string | number | null }) {
    const res = await this.client.put(`/checklist-items/${id}`, data);
    return res.data;
  }

  async deleteChecklistItem(id: string | number) {
    const res = await this.client.delete(`/checklist-items/${id}`);
    return res.data;
  }

  async convertChecklistItem(id: string | number, type: 'task' | 'subtask') {
    const res = await this.client.post(`/checklist-items/${id}/convert`, { type });
    return res.data;
  }

  // === ATTACHMENTS ===
  async uploadAttachment(taskId: string | number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.client.post(`/tasks/${taskId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }

  async deleteAttachment(id: string | number) {
    const res = await this.client.delete(`/attachments/${id}`);
    return res.data;
  }

  async renameAttachment(id: string | number, fileName: string) {
    const res = await this.client.put(`/attachments/${id}`, { file_name: fileName });
    return res.data;
  }

  async search(query: string) {
    const res = await this.client.get('/search', { params: { q: query } });
    return res.data;
  }

  async generateAiChecklist(taskId: string | number, prompt?: string, preview?: boolean, items?: string[]) {
    const res = await this.client.post(`/tasks/${taskId}/ai/checklist`, { prompt, preview, items });
    return res.data;
  }

  async generateAiSubtasks(taskId: string | number, prompt?: string, preview?: boolean, subtasks?: string[]) {
    const res = await this.client.post(`/tasks/${taskId}/ai/subtasks`, { prompt, preview, subtasks });
    return res.data;
  }

  async generateAiDescription(taskId: string | number, prompt?: string, preview?: boolean, description?: string) {
    const res = await this.client.post(`/tasks/${taskId}/ai/description`, { prompt, preview, description });
    return res.data;
  }

  async chatAiTask(taskId: string | number, messages: { role: 'user' | 'ai'; content: string }[]) {
    const res = await this.client.post(`/tasks/${taskId}/ai/chat`, { messages });
    return res.data;
  }

  async chatGlobalAi(messages: { role: 'user' | 'ai'; content: string }[]) {
    const res = await this.client.post('/ai/global/chat', { messages });
    return res.data;
  }

  getBackendUrl() {
    return API_BASE_URL.replace('/api', '');
  }

  getClient() {
    return this.client;
  }
}

const api = new ApiClient();
export default api;
