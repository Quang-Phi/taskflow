# 📋 TaskFlow – Tài liệu Kỹ thuật & Kiến trúc Hệ thống (Technical Specification)

> Tài liệu được cập nhật từ scan codebase thực tế.  
> Cập nhật lần cuối: **2026-06-08**

---

## 1. TECH STACK & KIẾN TRÚC HỆ THỐNG

Hệ thống TaskFlow hoạt động dưới dạng ứng dụng nhúng/tích hợp hoặc chạy độc lập, kết nối chặt chẽ với Bitrix24 của doanh nghiệp thông qua xác thực OAuth2 & Laravel Sanctum.

### Frontend

| Thư viện/Công nghệ | Phiên bản | Mục đích |
|---------------------|-----------|----------|
| React | 18 | UI framework, SPA |
| TypeScript | 5.x | Type safety |
| Ant Design (antd) | 5.x | UI component library |
| React Router DOM | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| SCSS Modules | - | Styling component-level |
| Recharts | 2.x | Biểu đồ báo cáo (Bar, Line, Pie, Donut) |
| @dnd-kit/core | 6.x | Drag & Drop (Kanban Board, workflow) |
| TipTap | 2.x | Rich text editor (descriptions) |
| Laravel Echo | 1.x | WebSocket client (kết nối Reverb/Pusher) |
| Pusher JS | 8.x | WebSocket transport layer |

**Routing (App.tsx):**
```
/                       → DashboardPage
/projects               → ProjectsPage
/projects/:id           → ProjectDetailPage
/projects/:id/workflow  → WorkflowEditor (embedded)
/my-tasks               → MyTasksPage
/timesheet              → TimesheetPage
/inbox                  → InboxPage
/analytics              → AnalyticsPage
/evaluations            → EvaluationsPage
/members                → MembersPage
/settings               → SettingsPage
```

**State Management:** Local component state (useState, useEffect, useCallback, useMemo). Không dùng Redux/Zustand. Global state chia sẻ qua Custom Window Events.

### Backend

| Thư viện/Công nghệ | Phiên bản | Mục đích |
|---------------------|-----------|----------|
| Laravel | 11 | PHP web framework |
| Laravel Sanctum | 4.x | API token authentication |
| Laravel Reverb | 1.x | Self-hosted WebSocket server |
| Laravel Echo Server | - | Broadcasting driver |
| MySQL | 8.0 | Relational database |
| Gemini API (Google) | - | AI Assistant (description/subtasks/checklist) |
| Carbon | 3.x | Date/time manipulation |

**Broadcasting:** Laravel Events (`TaskUpdated`, `TimeTrackingUpdated`) → Broadcast qua Reverb channel.

### Kiến trúc tổng quan

```
[Bitrix24 IFrame] → POST /api/callback → [Laravel Backend]
                                                 ↕ Sanctum Token
[React Frontend] ← → [Laravel REST API] ← → [MySQL DB]
                              ↕
                    [Laravel Reverb / Pusher]
                              ↕ WebSocket
                    [Laravel Echo (Frontend)]
```

---

## 2. DATABASE SCHEMA (Cơ sở dữ liệu thực tế)

### 2.1 Bảng `users` (Người dùng)

Lưu trữ thông tin user đồng bộ từ Bitrix24 hoặc tạo nội bộ.

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | int, PK | Khớp với Bitrix24 User ID |
| `bitrix_id` | string, null | Bitrix user ID (string) |
| `name` | string | Họ tên đầy đủ |
| `first_name` | string, null | |
| `last_name` | string, null | |
| `email` | string, unique | |
| `phone` | string, null | |
| `photo` | string, null | URL ảnh đại diện |
| `department_ids` | json, null | Mảng ID phòng ban |
| `work_position` | string, null | Chức danh |
| `role` | string | `superadmin`, `admin`, `manager`, `employee` |
| `active` | boolean | Trạng thái hoạt động |
| `theme` | string | `light`, `dark`, `system` (default: `dark`) |
| `timezone` | string | Default: `Asia/Ho_Chi_Minh` |
| `language` | string | `vi`, `en`, `ja` (default: `vi`) |
| `workspace_name` | string, null | |
| `notification_settings` | json, null | `{"taskAssigned": true, "taskComment": true, ...}` |
| `bitrix_access_token` | text, null | |
| `bitrix_refresh_token` | text, null | |
| `bitrix_token_expires` | datetime, null | |
| `bitrix_domain` | string, null | |
| `bitrix_member_id` | string, null | |
| `created_at`, `updated_at` | timestamps | |

### 2.2 Bảng `projects` (Dự án)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK, auto-increment | |
| `name` | string | Tên dự án |
| `description` | text, null | |
| `color` | string | Mã màu hex |
| `icon` | string, null | Tên icon emoji hoặc base64 ảnh |
| `priority` | string | Mức độ ưu tiên project |
| `status` | string | `active`, `on_hold`, `completed`, `planning` |
| `statuses` | json, null | **Workflow config** – xem chi tiết bên dưới |
| `workflow` | json, null | `{"mode": "restricted\|unrestricted", "transitions": [...], "global_transitions": [...], "initial_status": "status_id"}` |
| `start_date` | date, null | |
| `end_date` | date, null | |
| `created_by` | int, FK → `users.id` | |
| `created_at`, `updated_at` | timestamps | |
| `deleted_at` | timestamp, null | Soft delete |

**Cấu trúc `statuses` JSON (Project Workflow):**
```json
[
  {
    "id": "uuid-string",
    "name": "Cần làm",
    "color": "#6b7084",
    "type": "not_started",
    "position": { "x": 100, "y": 200 }
  },
  {
    "id": "uuid-string",
    "name": "Đang làm",
    "color": "#3b82f6",
    "type": "active",
    "position": { "x": 300, "y": 200 }
  },
  {
    "id": "uuid-string",
    "name": "Hoàn thành",
    "color": "#22c55e",
    "type": "closed",
    "position": { "x": 500, "y": 200 }
  }
]
```

**Cấu trúc `workflow` JSON:**
```json
{
  "mode": "restricted",
  "initial_status": "uuid-status-id",
  "transitions": [
    {
      "id": "uuid",
      "from": "status-id-A",
      "to": "status-id-B",
      "name": "Bắt đầu làm",
      "allowed_roles": ["manager", "admin"],
      "rules": [
        { "type": "assign_user", "config": { "to": "current_user" } },
        { "type": "update_field", "config": { "field": "priority", "value": "high" } }
      ]
    }
  ],
  "global_transitions": [
    {
      "id": "uuid",
      "to": "cancelled-status-id",
      "name": "Hủy",
      "allowed_roles": ["admin"]
    }
  ]
}
```

### 2.3 Bảng `project_members` (Thành viên dự án)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `project_id` | bigint, FK → `projects.id` | |
| `user_id` | int, FK → `users.id` | |
| `role` | string | `manager`, `member` (default: `member`) |
| `joined_at` | timestamp, null | |
| `created_at`, `updated_at` | timestamps | |

### 2.4 Bảng `tasks` (Công việc)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `project_id` | bigint, FK → `projects.id` | |
| `title` | string | Tiêu đề task |
| `description` | text, null | Mô tả (rich text HTML) |
| `status` | string | ID của status trong project workflow |
| `priority` | string | `urgent`, `high`, `medium`, `low`, (none) |
| `type` | string | `task`, `bug` (default: `task`) |
| `assignee_id` | int, null, FK → `users.id` | |
| `creator_id` | int, FK → `users.id` | |
| `estimated_hours` | decimal, null | Tự động tính từ start_date → due_date |
| `actual_hours` | decimal, null | |
| `start_date` | datetime, null | |
| `due_date` | datetime, null | |
| `completed_at` | datetime, null | Tự động set khi status type = `closed` |
| `parent_task_id` | bigint, null, FK → `tasks.id` | Subtask |
| `position` | int | Thứ tự trong Kanban column |
| `watcher_ids` | json, null | Mảng user ID người theo dõi |
| `is_recurring` | boolean | Task định kỳ |
| `recurring_frequency` | string, null | `daily`, `weekly`, `monthly`, `yearly` |
| `recurring_interval` | int | Khoảng cách (default: 1) |
| `recurring_weekdays` | json, null | Mảng số ngày trong tuần (1-7, ISO weekday) |
| `recurring_monthday` | int, null | Ngày trong tháng (1-31) |
| `recurring_time` | string, null | Giờ thực hiện (HH:MM) |
| `recurring_next_trigger` | datetime, null | Lần tiếp theo task được tạo tự động |
| `milestone_id` | bigint, null, FK → `milestones.id` | |
| `created_at`, `updated_at` | timestamps | |
| `deleted_at` | timestamp, null | Soft delete |

**Task Model Observers (`Task::booted()`):**
- `created`: Tự động tạo `TaskStatusHistory` record (from_status = null).
- `updated` (nếu `status` thay đổi): Tạo `TaskStatusHistory` record.

**Recurring Task Logic (`Task::processRecurrence()`):**
- Khi cron job trigger `recurring_next_trigger` đến hạn:
  1. Clone task gốc thành task mới (không recurring).
  2. Tạo `TaskDependency` loại `clones` giữa task mới và task gốc.
  3. Tính `recurring_next_trigger` mới cho task gốc.
  4. Broadcast `TaskUpdated` event.

### 2.5 Bảng `task_dependencies` (Phụ thuộc task)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | Task nguồn |
| `target_task_id` | bigint, FK → `tasks.id` | Task đích |
| `type` | string | `blocks`, `is_blocked_by`, `clones`, `is_cloned_by`, `relates_to` |
| `created_by` | int, FK → `users.id` | |
| `created_at`, `updated_at` | timestamps | |

### 2.6 Bảng `task_status_history` (Lịch sử trạng thái)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `from_status` | string, null | Status ID trước |
| `to_status` | string | Status ID sau |
| `changed_by` | int, FK → `users.id` | |
| `changed_at` | datetime | |
| `created_at`, `updated_at` | timestamps | |

### 2.7 Bảng `milestones` (Mốc dự án)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `project_id` | bigint, FK → `projects.id` | |
| `name` | string | |
| `description` | text, null | |
| `due_date` | date, null | |
| `status` | string | `open`, `completed` |
| `created_by` | int, FK → `users.id` | |
| `created_at`, `updated_at` | timestamps | |

### 2.8 Bảng `checklists` và `checklist_items`

**checklists:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `name` | string | Tên nhóm checklist |
| `position` | int | Thứ tự hiển thị |
| `created_at`, `updated_at` | timestamps | |

**checklist_items:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `checklist_id` | bigint, FK → `checklists.id` | |
| `name` | string | Nội dung kiểm tra |
| `is_checked` | boolean | Đã hoàn thành |
| `assignee_id` | int, null, FK → `users.id` | Người được gán |
| `position` | int | |
| `created_at`, `updated_at` | timestamps | |

### 2.9 Bảng `custom_fields` và `custom_field_values`

**custom_fields:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `project_id` | bigint, FK → `projects.id` | |
| `name` | string | Tên trường |
| `type` | string | `text`, `number`, `date`, `dropdown`, `checkbox` |
| `options` | json, null | Giá trị lựa chọn (nếu dropdown) |
| `created_at`, `updated_at` | timestamps | |

**custom_field_values:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `custom_field_id` | bigint, FK → `custom_fields.id` | |
| `value` | text | Giá trị dạng string |
| `created_at`, `updated_at` | timestamps | |

### 2.10 Bảng `time_entries` (Nhật ký thời gian)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `user_id` | int, FK → `users.id` | |
| `started_at` | datetime | Thời điểm bắt đầu |
| `ended_at` | datetime, null | Thời điểm kết thúc (null = đang chạy) |
| `duration` | int, null | Thời lượng (giây) |
| `description` | text, null | Ghi chú |
| `created_at`, `updated_at` | timestamps | |

**Quy tắc:**
- Mỗi user chỉ có tối đa **1 entry** đang chạy (`ended_at = null`) tại một thời điểm.
- Khi `stopTimer`: set `ended_at = now()`, tính `duration = ended_at - started_at`.
- Khi đổi assignee: timer của assignee cũ tự động dừng.

### 2.11 Bảng `task_comments` và `comment_reactions`

**task_comments:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `user_id` | int, FK → `users.id` | |
| `parent_id` | bigint, null, FK → `task_comments.id` | Thread replies |
| `comment` | text | Nội dung |
| `attachment_path` | string, null | Đường dẫn file đính kèm |
| `created_at`, `updated_at` | timestamps | |

**comment_reactions:**
| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `comment_id` | bigint, FK → `task_comments.id` | |
| `user_id` | int, FK → `users.id` | |
| `reaction` | string | Emoji reaction |
| `created_at`, `updated_at` | timestamps | |

### 2.12 Bảng `task_activities` (Lịch sử hoạt động)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `user_id` | int, FK → `users.id` | |
| `action` | string | `created`, `updated_title`, `updated_status`, `updated_assignee`, `updated_priority`, `updated_description`, `updated_start_date`, `updated_due_date`, `updated_estimated_hours`, `started_timer`, `stopped_timer`, `added_comment`, `linked_task`,... |
| `details` | text, null | Mô tả chi tiết thay đổi |
| `created_at`, `updated_at` | timestamps | |

### 2.13 Bảng `task_attachments` (Tệp đính kèm)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `user_id` | int, FK → `users.id` | Người upload |
| `file_name` | string | Tên file gốc |
| `file_path` | string | Đường dẫn lưu trữ |
| `file_size` | int, null | Kích thước (bytes) |
| `mime_type` | string, null | |
| `created_at`, `updated_at` | timestamps | |

### 2.14 Bảng `evaluations` (Đánh giá hiệu suất)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `period` | string | Kỳ đánh giá (định dạng `YYYY-MM`) |
| `employee_id` | int, FK → `users.id` | Nhân viên được đánh giá |
| `evaluator_id` | int, FK → `users.id` | Người đánh giá |
| `total_tasks` | int | Tổng task trong kỳ |
| `completed_tasks` | int | Task đã hoàn thành |
| `on_time_tasks` | int | Task hoàn thành đúng hạn |
| `on_time_rate` | float | Tỷ lệ đúng hạn (%) |
| `total_score` | float | Điểm tổng (1-10). Công thức: `50% × on_time_rate/10 + 50% × completed/total×10` |
| `comment` | text, null | Nhận xét của Manager |
| `status` | string | `draft`, `published` (default: `draft`) |
| `published_at` | datetime, null | |
| `created_at`, `updated_at` | timestamps | |

### 2.15 Bảng `notifications` (Thông báo)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `user_id` | int, FK → `users.id` | Người nhận |
| `actor_id` | int, null, FK → `users.id` | Người thực hiện hành động |
| `type` | string | `task_assigned`, `comment`, `mention`, `reply`, `reaction`, `status_changed`, `deadline`, `evaluation`, `project_added` |
| `action` | string | Mô tả hành động (ví dụ: "commented on") |
| `target` | string | Tên task/project đích |
| `extra` | string, null | Chi tiết thêm (ví dụ: "todo → in_progress") |
| `task_id` | bigint, null, FK → `tasks.id` | |
| `project_id` | bigint, null, FK → `projects.id` | |
| `read` | boolean | Default: `false` |
| `created_at`, `updated_at` | timestamps | |

### 2.16 Bảng `status_templates` (Mẫu trạng thái Kanban)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `name` | string | Tên template |
| `statuses` | json | Mảng statuses (giống cấu trúc project.statuses) |
| `created_at`, `updated_at` | timestamps | |

### 2.17 Bảng `task_templates` (Mẫu task)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `name` | string | Tên template |
| `description` | text, null | Mô tả mặc định |
| `type` | string | `task`, `bug` |
| `priority` | string | `urgent`, `high`, `medium`, `low` |
| `estimated_hours` | int, null | |
| `checklist_template` | json, null | `[{"name": "...", "items": [...]}]` |
| `subtask_template` | json, null | `[{"title": "...", "priority": "..."}]` |
| `source_task_id` | bigint, null, FK → `tasks.id` | Task gốc nếu template được tạo từ task |
| `created_by` | int, FK → `users.id` | |
| `created_at`, `updated_at` | timestamps | |

### 2.18 Bảng `task_approvals` (Phê duyệt task)

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | bigint, PK | |
| `task_id` | bigint, FK → `tasks.id` | |
| `user_id` | int, FK → `users.id` | Reviewer |
| `status` | string | `pending`, `approved`, `rejected` |
| `comment` | text, null | |
| `created_at`, `updated_at` | timestamps | |

---

## 3. DANH SÁCH API ENDPOINTS

Tất cả API yêu cầu header `Authorization: Bearer <sanctum_token>` (ngoại trừ `/api/callback`).

### 3.1 Authentication & Profile

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/callback` | OAuth2 callback từ Bitrix24, trả về Sanctum token |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại |
| POST | `/api/auth/logout` | Đăng xuất, thu hồi token |
| PUT | `/api/auth/settings` | Cập nhật theme/timezone/language/workspace_name/notification_settings |

### 3.2 Users & Bitrix Integration

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/users` | Danh sách user nội bộ (có phân trang, search, filter active) |
| GET | `/api/bitrix/users` | Proxy lấy nhân viên từ Bitrix24 |
| GET | `/api/bitrix/users/{id}` | Chi tiết nhân viên Bitrix24 |
| PUT | `/api/bitrix/users/{id}` | Cập nhật thông tin nhân viên Bitrix24 |
| GET | `/api/bitrix/departments` | Danh sách phòng ban từ Bitrix24 |
| GET | `/api/bitrix/custom` | Proxy cho các Bitrix24 API khác |

### 3.3 Projects

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects` | Danh sách dự án (phân trang 12/trang, search, filter status) |
| POST | `/api/projects` | Tạo dự án mới |
| GET | `/api/projects/{id}` | Chi tiết dự án (kèm members, tasks, workflow) |
| PUT | `/api/projects/{id}` | Cập nhật dự án |
| DELETE | `/api/projects/{id}` | Xóa dự án (Soft delete) |
| POST | `/api/projects/{id}/members` | Thêm thành viên vào dự án |
| DELETE | `/api/projects/{id}/members/{userId}` | Xóa thành viên khỏi dự án |
| PUT | `/api/projects/{id}/members/{userId}/role` | Đổi role thành viên (manager/member) |
| PUT | `/api/projects/{id}/statuses` | Lưu workflow (statuses + transitions + positions + initial_status) |
| GET | `/api/projects/{id}/time-entries` | Thống kê nhật ký giờ làm của project |
| GET | `/api/status-templates` | Danh sách mẫu trạng thái Kanban |
| POST | `/api/status-templates` | Tạo mẫu trạng thái mới |
| DELETE | `/api/status-templates/{id}` | Xóa mẫu trạng thái |

### 3.4 Tasks

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks` | Danh sách task (filter: project_id, assignee_id, creator_id) |
| POST | `/api/tasks` | Tạo task mới |
| GET | `/api/tasks/{id}` | Chi tiết task (eager load: assignee, creator, labels, project, parentTask, comments, activities, subtasks, timeEntries, customFieldValues, checklists, attachments, dependencies) |
| PUT | `/api/tasks/{id}` | Cập nhật task (validate workflow transition) |
| DELETE | `/api/tasks/{id}` | Xóa task (Soft delete) |
| PUT | `/api/tasks/{id}/status` | Cập nhật nhanh status (validate workflow) |
| POST | `/api/tasks/reorder` | Reorder tasks (drag & drop, update positions) |
| GET | `/api/tasks/{id}/comments` | Danh sách bình luận (limit 15, newest first) |
| POST | `/api/tasks/{id}/comments` | Đăng bình luận mới |
| PUT | `/api/comments/{id}` | Chỉnh sửa bình luận |
| DELETE | `/api/comments/{id}` | Xóa bình luận |
| POST | `/api/comments/{id}/react` | Thả/bỏ reaction emoji |
| GET | `/api/tasks/{id}/activities` | Lịch sử hoạt động (limit 20, newest first) |
| POST | `/api/tasks/{id}/watch` | Toggle theo dõi/hủy theo dõi task |
| POST | `/api/tasks/{id}/timer/start` | Bắt đầu bộ đếm giờ tự động |
| POST | `/api/tasks/{id}/timer/stop` | Dừng bộ đếm giờ và lưu duration |
| POST | `/api/tasks/{id}/time-entries` | Log giờ thủ công |
| GET | `/api/me/timer/running` | Kiểm tra timer đang chạy của user |
| GET | `/api/me/time-entries/today` | Danh sách log hôm nay |
| GET | `/api/time-entries` | Danh sách log (filter: user_id, start_date, end_date, view_all) |
| DELETE | `/api/time-entries/{id}` | Xóa một log giờ |

### 3.5 Milestones

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/{id}/milestones` | Danh sách milestones của project |
| POST | `/api/projects/{id}/milestones` | Tạo milestone mới |
| PUT | `/api/milestones/{id}` | Cập nhật milestone |
| DELETE | `/api/milestones/{id}` | Xóa milestone |

### 3.6 AI Assistant

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/{id}/ai/description` | AI sinh/tóm tắt mô tả task |
| POST | `/api/tasks/{id}/ai/subtasks` | AI sinh danh sách subtask gợi ý |
| POST | `/api/tasks/{id}/ai/checklist` | AI sinh danh sách checklist gợi ý |
| POST | `/api/tasks/{id}/ai/chat` | Chat AI trong context task cụ thể |
| POST | `/api/ai/global/chat` | Chat AI toàn cục (không cần context task) |

### 3.7 Custom Fields

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/{id}/custom-fields` | Danh sách custom fields của project |
| POST | `/api/projects/{id}/custom-fields` | Tạo custom field mới |
| DELETE | `/api/custom-fields/{id}` | Xóa custom field |
| POST | `/api/tasks/{taskId}/custom-field-values` | Cập nhật giá trị custom field |

### 3.8 Checklists & Items

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/{taskId}/checklists` | Tạo checklist mới |
| PUT | `/api/checklists/{id}` | Cập nhật tên/position checklist |
| DELETE | `/api/checklists/{id}` | Xóa checklist |
| POST | `/api/checklists/{id}/items` | Tạo checklist item mới |
| PUT | `/api/checklist-items/{id}` | Cập nhật item (name, is_checked, assignee_id, position) |
| DELETE | `/api/checklist-items/{id}` | Xóa checklist item |
| POST | `/api/checklist-items/{id}/convert` | Chuyển item thành subtask hoặc task độc lập |

### 3.9 Attachments

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/{taskId}/attachments` | Upload file đính kèm |
| PUT | `/api/attachments/{id}` | Đổi tên file |
| DELETE | `/api/attachments/{id}` | Xóa file đính kèm |

### 3.10 Task Templates

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/task-templates` | Danh sách templates |
| POST | `/api/task-templates` | Tạo template mới |
| PUT | `/api/task-templates/{id}` | Cập nhật template |
| DELETE | `/api/task-templates/{id}` | Xóa template |

### 3.11 Task Dependencies

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/{id}/dependencies` | Thêm dependency |
| DELETE | `/api/task-dependencies/{id}` | Xóa dependency |

### 3.12 Task Approvals

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/{id}/approvals` | Tạo approval request |
| PUT | `/api/approvals/{id}` | Cập nhật approval (approve/reject + comment) |

### 3.13 Evaluations & Performance

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/evaluations` | Danh sách đánh giá (filter: period, status; phân trang 10/trang) |
| POST | `/api/evaluations/generate` | Auto-generate evaluations cho kỳ được chọn |
| GET | `/api/evaluations/{id}` | Chi tiết đánh giá (kèm danh sách task trong kỳ) |
| PUT | `/api/evaluations/{id}` | Lưu nháp hoặc Publish (chỉ Manager/Admin) |

### 3.14 Notifications & Search

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/notifications` | Danh sách thông báo (phân trang, filter: tab=unread/mention/assigned) |
| POST | `/api/notifications/read` | Đánh dấu đã đọc (một hoặc tất cả) |
| GET | `/api/notifications/unread-count` | Số thông báo chưa đọc |
| GET | `/api/search` | Tìm kiếm toàn cục (Tasks, Projects, Members, Comments) |

---

## 4. QUY TRÌNH XÁC THỰC SSO & TÍCH HỢP BITRIX24

### Luồng OAuth2 (Bitrix24 IFrame)

1. User mở TaskFlow từ bên trong Bitrix24.
2. Bitrix24 gửi HTTP POST kèm `AUTH_ID` và chữ ký tới `/api/callback`.
3. Backend Laravel xác minh chữ ký với Bitrix24 server.
4. Nếu user chưa tồn tại: Fetch thông tin từ `user.current` API → Tạo tài khoản mới trong bảng `users`.
5. Nếu đã tồn tại: Cập nhật `bitrix_access_token`, `bitrix_refresh_token`.
6. Backend sinh Sanctum token và trả về cho frontend.
7. Frontend lưu token vào `localStorage` và gắn vào header `Authorization: Bearer <token>` trong mọi request tiếp theo.

### API Proxy Bitrix24

Backend Laravel đóng vai trò **proxy** cho các Bitrix24 API. Frontend gọi `GET /api/bitrix/users` → Backend dùng `bitrix_access_token` của user hiện tại để gọi Bitrix24 API và trả kết quả về. Điều này giúp giữ token Bitrix an toàn ở phía server.

---

## 5. CƠ CHẾ THỜI GIAN THỰC (Real-time)

### WebSocket Architecture

```
[Laravel App] → [TaskUpdated Event] → [Laravel Reverb]
                                              ↕ WebSocket
                                    [Laravel Echo (React)]
```

### Broadcasting Events

| Event | Channel | Mô tả |
|-------|---------|-------|
| `TaskUpdated` | `project.{id}` | Khi task được tạo/cập nhật/xóa trong project |
| `TimeTrackingUpdated` | `user.{id}` (private) | Khi timer start/stop |
| `notification.received` | `App.Models.User.{id}` (private) | Khi user nhận notification mới |
| `timer.updated` | `App.Models.User.{id}` (private) | Khi timer được cập nhật (kèm server time) |

### Server Time Sync

Header lưu `taskflow_server_time_offset` (ms) vào localStorage:
```
offset = serverTime.getTime() - Date.now()
correctedTime = Date.now() + offset
```
Dùng để tính chính xác thời gian elapsed timer bù lệch giữa client và server.

### Custom Window Events (Frontend-only)

| Event | Dispatch khi | Listener ở |
|-------|--------------|------------|
| `timer-updated` | Timer start/stop | Header, Timesheet |
| `projects-changed` | Create/Update/Delete project | Sidebar |
| `unread-count-changed` | Nhận notification mới | Header, Sidebar |
| `notification-received-global` | Echo `.notification.received` | InboxPage |
| `open-create-task-modal` | Header "+ New" → Task | CreateTaskModal |
| `open-global-search` | Header search bar click | SearchModal |
| `theme-changed` | Settings thay đổi theme | Layout |
| `language-changed` | Settings thay đổi ngôn ngữ | i18n util |

---

## 6. PHÂN QUYỀN & BẢO MẬT

### Role Hierarchy

```
superadmin > admin > manager > employee
```

### Quy tắc phân quyền Task

| Hành động | Admin/SuperAdmin | Project Creator | Project Manager | Project Member | Assignee/Creator |
|-----------|-----------------|-----------------|-----------------|----------------|-----------------|
| Xem task | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo task | ✅ | ✅ | ✅ | ✅ (chỉ tự assign) | - |
| Sửa task | ✅ | ✅ | ✅ | Chỉ task của mình | ✅ |
| Xóa task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign cho người khác | ✅ | ✅ | ✅ | ❌ (main task) | ❌ |
| Log time cho người khác | ✅ | ✅ | ✅ | ❌ | ❌ |
| Xóa log time | ✅ (admin) | - | - | ❌ | ✅ (chính mình) |

### Workflow Validation (Backend)

Khi có `status` thay đổi trong `PUT /api/tasks/{id}`:
1. Backend gọi `checkWorkflowTransition($task, $newStatus, $user)`.
2. Nếu workflow mode = `restricted`: Kiểm tra transitions array xem có transition từ `current_status` → `new_status` không.
3. Nếu không có transition hợp lệ: Trả về HTTP 422 kèm thông báo lỗi.
4. Nếu hợp lệ: Thực thi `post-action rules` (assign_user, update_field,...).
5. Nếu transition có `allowed_roles`: Kiểm tra role user có được phép không.

---

## 7. CÀI ĐẶT MÔI TRƯỜNG & CẤU HÌNH

### Frontend (`taskflow-fe/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_REVERB_APP_KEY=your_reverb_key
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### Backend (`taskflow-be/.env`)

```env
APP_NAME=TaskFlow
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=taskflow
DB_USERNAME=root
DB_PASSWORD=

# Bitrix24 OAuth2
BITRIX_CLIENT_ID=...
BITRIX_CLIENT_SECRET=...

# WebSocket
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=...
REVERB_APP_KEY=...
REVERB_APP_SECRET=...
REVERB_SCHEME=http
REVERB_HOST=localhost
REVERB_PORT=8080

# AI
GEMINI_API_KEY=...

# File Storage
FILESYSTEM_DISK=public

# Queue (local)
QUEUE_CONNECTION=sync

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:5173
```

---

## 8. KẾ HOẠCH TRIỂN KHAI PRODUCTION

### 8.1 File Storage

- **Local**: `FILESYSTEM_DISK=public` → Lưu vào `/storage/app/public`.
- **Production**: Chuyển sang **Amazon S3** hoặc S3-compatible (MinIO, Cloudflare R2):
  ```env
  FILESYSTEM_DISK=s3
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_DEFAULT_REGION=ap-southeast-1
  AWS_BUCKET=taskflow-production
  AWS_URL=https://taskflow-production.s3.amazonaws.com
  ```

### 8.2 WebSocket Broadcasting

- **Local**: Laravel Reverb (`BROADCAST_CONNECTION=reverb`), cổng 8080, HTTP.
- **Production**: Có 2 lựa chọn:
  - **SaaS Pusher** (khuyến nghị):
    ```env
    BROADCAST_CONNECTION=pusher
    PUSHER_APP_ID=...
    PUSHER_APP_KEY=...
    PUSHER_APP_SECRET=...
    PUSHER_APP_CLUSTER=ap1
    ```
  - **Self-hosted Reverb + Nginx SSL**: Đặt sau Nginx proxy với SSL (WSS), dùng Redis làm pub/sub.

### 8.3 Database

- **Local**: MySQL 8.0 localhost.
- **Production**: AWS RDS MySQL hoặc Google Cloud SQL. Cấu hình Read/Write splitting, auto-backup hàng ngày.

### 8.4 Queue & Cache

- **Local**: `QUEUE_CONNECTION=sync` (xử lý đồng bộ).
- **Production**: `QUEUE_CONNECTION=redis` + Laravel Horizon để giám sát queue workers.

### 8.5 Bitrix24 OAuth2 Production

- Đăng ký ứng dụng chính thức trên Bitrix24 production portal.
- Cập nhật Callback URL: `https://taskflow.company.com/api/callback`.
- Cập nhật `BITRIX_CLIENT_ID` và `BITRIX_CLIENT_SECRET`.

### 8.6 Bảo mật & CORS

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://taskflow-api.company.com
FRONTEND_URL=https://taskflow.company.com
```

- **SSL**: Bắt buộc cho cả frontend và backend (HTTPS/WSS).
- **CORS**: `config/cors.php` chỉ cho phép `FRONTEND_URL`.
- **Rate Limiting**: Cấu hình Laravel rate limiting cho API endpoints.

---

## 9. PHÁT TRIỂN & CHẠY LOCAL

### Frontend

```bash
cd taskflow-fe
npm install
npm run dev  # Vite dev server tại http://localhost:5173
```

### Backend

```bash
cd taskflow-be
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed  # Nếu cần seed data
php artisan serve    # tại http://localhost:8000

# WebSocket (cửa sổ terminal riêng)
php artisan reverb:start

# Queue (nếu dùng queue driver khác sync)
php artisan queue:work
```

---

*Cập nhật lần cuối: 2026-06-08 | Phiên bản: Scan codebase thực tế đầy đủ*
