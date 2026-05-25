import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private client: AxiosInstance;

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
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          const isBitrixError = error.config?.url?.includes('/bitrix/') || 
                                error.response?.data?.message?.toLowerCase().includes('bitrix');
          
          if (!isBitrixError) {
            localStorage.removeItem('taskflow_token');
          }
          
          console.warn(`[API] 401 Unauthorized ${isBitrixError ? '(Bitrix token issue)' : '(Session expired)'}. Redirecting to auth...`);
          const backendUrl = API_BASE_URL.replace('/api', '');
          window.location.href = `${backendUrl}/auth/redirect`;
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
    score_quality?: number;
    score_responsibility?: number;
    score_communication?: number;
    score_creativity?: number;
    score_discipline?: number;
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
    priority?: 'low' | 'medium' | 'high';
    status?: 'planning' | 'active' | 'completed' | 'on_hold';
    start_date?: string;
    end_date?: string;
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
    status?: 'todo' | 'in_progress' | 'review' | 'done';
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

  async updateTaskStatus(id: string | number, data: { status: 'todo' | 'in_progress' | 'review' | 'done'; position?: number }) {
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

  async search(query: string) {
    const res = await this.client.get('/search', { params: { q: query } });
    return res.data;
  }

  // === AI ASSISTANT ===
  async generateAiChecklist(taskId: string | number, prompt?: string) {
    const res = await this.client.post(`/tasks/${taskId}/ai/checklist`, { prompt });
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

  getClient() {
    return this.client;
  }
}

const api = new ApiClient();
export default api;
