# 🚀 TaskFlow — Improvement Roadmap

> **Mục tiêu:** Nâng cấp TaskFlow từ công cụ phù hợp Engineering/Product → nền tảng phục vụ đa phòng ban (Engineering, Operations, Finance, HR, Sales).
>
> **Tham chiếu:** Jira, ClickUp, Asana, Linear, Monday.com
>
> **Cập nhật lần cuối:** 2026-06-05

---

## Phân loại độ ưu tiên

| Ký hiệu | Ý nghĩa |
|---------|---------|
| 🔴 P0 | Critical — Ảnh hưởng cốt lõi, làm ngay |
| 🟠 P1 | High — Mở rộng use case đáng kể |
| 🟡 P2 | Medium — Cải thiện trải nghiệm |
| 🔵 P3 | Low — Nice to have |

---

## 🔴 P0 — Critical (Làm trước nhất)

---

### ✅ I1 — Multi-assignee & Reviewer Role

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering, QA, Design, Operations
- **Vấn đề hiện tại:**
  Mỗi task chỉ có 1 `assignee_id`. Thực tế 1 task thường cần Developer thực hiện + QA kiểm tra + Tech Lead review. Không có cách phân vai trò rõ ràng.
- **Tham chiếu:** Jira có `Assignee` + `Reporter`; ClickUp có multi-assignee tự do.
- **Phương án triển khai:**

  **Backend:**
  ```sql
  -- Thêm bảng task_assignees
  CREATE TABLE task_assignees (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('assignee', 'reviewer', 'reporter') DEFAULT 'assignee',
    assigned_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY (task_id, user_id)
  );
  ```
  Giữ `assignee_id` trên bảng `tasks` làm primary assignee (backward compatible).

  **Frontend:**
  - Task Detail: thêm section "Người tham gia" với multi-select avatar picker.
  - Badge phân vai: màu khác nhau cho Assignee / Reviewer / Reporter.
  - Board card: hiển thị avatar stack thay vì 1 avatar.

  **Notification:**
  - Mỗi assignee trong bảng đều nhận thông báo khi task thay đổi.
  - Reviewer nhận thông báo riêng khi task vào trạng thái "Review".

---

### ✅ I2 — Task Dependencies (Phụ thuộc giữa task)

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering, Product, Operations, Project Management
- **Vấn đề hiện tại:**
  Không có quan hệ phụ thuộc giữa các task. PM không biết task nào đang bị chặn, không thể lập critical path.
- **Tham chiếu:** Jira có `blocks/is blocked by/relates to/duplicates`; Asana có `dependencies` với cảnh báo tự động.
- **Phương án triển khai:**

  **Backend:**
  ```sql
  CREATE TABLE task_dependencies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,           -- task bị ảnh hưởng
    depends_on_task_id BIGINT NOT NULL, -- task phải xong trước
    type ENUM('blocks', 'relates_to', 'duplicates') DEFAULT 'blocks',
    created_by INT NOT NULL,
    created_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id)
  );
  ```

  **Logic:**
  - Khi task `depends_on_task_id` bị trễ deadline → tự động gửi cảnh báo cho task phụ thuộc.
  - Workflow validation: nếu type = `blocks`, không cho chuyển task sang `In Progress` khi task nguồn chưa `Done` (có thể override nếu được phép).
  - API: `POST /api/tasks/{id}/dependencies`, `DELETE /api/task-dependencies/{id}`.

  **Frontend:**
  - Task Detail: section "Phụ thuộc" hiển thị danh sách task liên kết có trạng thái.
  - Board card: icon 🔗 khi task đang bị block.
  - Cảnh báo inline: "Task này đang chặn 3 task khác" khi task bị trễ.

---

### ✅ I3 — Recurring Tasks (Task định kỳ)

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Operations, Finance, HR, Marketing
- **Vấn đề hiện tại:**
  Không có task lặp lại. Phòng Operations, Finance phải tạo tay hàng tuần/tháng (báo cáo, đối soát, họp định kỳ).
- **Tham chiếu:** ClickUp hỗ trợ `Recurrence` với cron expression; Asana có `repeat task`.
- **Phương án triển khai:**

  **Backend:**
  ```sql
  -- Thêm vào bảng tasks
  ALTER TABLE tasks ADD COLUMN recurrence_rule VARCHAR(100) NULL;
  -- VD: "FREQ=WEEKLY;BYDAY=MO" hoặc "FREQ=MONTHLY;BYMONTHDAY=1"
  ALTER TABLE tasks ADD COLUMN recurrence_end_date DATE NULL;
  ALTER TABLE tasks ADD COLUMN recurrence_parent_id BIGINT NULL;
  ```

  ```php
  // Laravel Scheduled Job — chạy mỗi đêm 00:00
  // Tìm task Done có recurrence_rule → clone task với due_date mới
  // Giữ nguyên: title, description, assignee, checklist template, custom fields
  // Reset: status về initial, completed_at = null, time_entries = []
  ```

  **Frontend:**
  - Task Create Modal: thêm section "Lặp lại" với picker: Không / Hàng ngày / Hàng tuần / Hàng tháng / Tùy chỉnh.
  - Task Detail: badge "🔄 Lặp lại mỗi thứ Hai" với link xem/sửa lịch.
  - My Tasks Calendar: hiển thị recurring task mờ hơn ở các ngày tương lai.

---

### ✅ I4 — Task Templates (Mẫu task)

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Tất cả phòng ban
- **Vấn đề hiện tại:**
  Các task có cấu trúc lặp lại (onboarding nhân viên, bug report, deploy checklist) phải tạo từ đầu mỗi lần. Tốn thời gian, dễ sót bước.
- **Tham chiếu:** ClickUp Templates, Notion Templates, Jira Issue Templates.
- **Phương án triển khai:**

  **Backend:**
  ```sql
  CREATE TABLE task_templates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NULL,    -- NULL = global template (dùng cho mọi dự án)
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    type VARCHAR(50) DEFAULT 'task',
    priority VARCHAR(50) DEFAULT 'medium',
    estimated_hours DECIMAL(8,2) NULL,
    checklist_template JSON NULL,   -- [{ name: "Nhóm A", items: ["Bước 1", "Bước 2"] }]
    subtask_template JSON NULL,     -- [{ title: "Subtask A", priority: "high" }]
    custom_field_defaults JSON NULL,
    created_by INT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  );
  ```

  **Frontend:**
  - Nút "Save as Template" trong Task Detail.
  - Task Create Modal: dropdown "Áp dụng mẫu" ở đầu form.
  - Trang Settings > Templates: quản lý, xem trước, xóa template.

---

## 🟠 P1 — High Priority

---

### ✅ I5 — Sprint / Milestone Tracking

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering (Sprint), Product, Marketing (Campaign Milestone)
- **Vấn đề hiện tại:**
  Không có khái niệm nhóm công việc theo giai đoạn thời gian. Engineering không theo dõi được velocity; Marketing không track được tiến độ campaign.
- **Phương án:** Triển khai **Milestone** (nhẹ hơn Sprint, phù hợp đa phòng ban hơn).

  **Backend:**
  ```sql
  CREATE TABLE milestones (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_date DATE NULL,
    due_date DATE NULL,
    status ENUM('planned', 'active', 'completed', 'cancelled') DEFAULT 'planned',
    goal TEXT NULL,         -- Sprint goal / Milestone objective
    created_by INT NOT NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  );

  -- Liên kết task với milestone
  ALTER TABLE tasks ADD COLUMN milestone_id BIGINT NULL REFERENCES milestones(id);
  ```

  **Frontend:**
  - Project Detail: tab mới "Milestones" — timeline view các milestone.
  - Mỗi milestone: thanh progress (% task done), danh sách task, ngày còn lại.
  - Board: filter theo milestone, nhóm task theo milestone.
  - Analytics: Burndown chart per milestone.

---

### ✅ I6 — Epic / 3-Level Task Hierarchy

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering, Product, Large-scale Operations
- **Vấn đề hiện tại:**
  Chỉ có Task → Subtask (2 cấp). Dự án lớn cần: Epic → Task → Subtask.
- **Phương án:**
  Không tạo bảng mới — mở rộng `task_type` hiện có:

  ```sql
  -- task_type: 'epic' | 'task' | 'bug' | 'subtask'
  ALTER TABLE tasks MODIFY type ENUM('epic', 'task', 'bug') DEFAULT 'task';
  ```

  **Logic:**
  - `epic` không có `due_date` cứng, tính deadline động từ task con có due_date muộn nhất.
  - `epic` không gán Assignee cụ thể, chỉ có Owner (người quản lý epic).
  - Progress của epic = % task con ở trạng thái "done".

  **Frontend:**
  - Epic hiển thị khác biệt trên Board: thẻ lớn hơn, màu nền riêng.
  - Task Create: dropdown chọn "Thuộc Epic" thay vì chỉ "Task cha".
  - Sidebar epic: danh sách task con + progress bar.

---

### ✅ I7 — WIP Limits trên Kanban Board

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering, Operations
- **Vấn đề hiện tại:**
  Không giới hạn số task đang In Progress. Thành viên nhận quá nhiều task cùng lúc → không hoàn thành thứ nào, bottleneck không rõ.
- **Phương án:**

  ```sql
  -- Thêm vào cấu trúc statuses trong projects.statuses JSON
  -- { id, name, color, type, wip_limit: 5 }  -- null = không giới hạn
  ```

  **Frontend:**
  - Project Settings > Statuses: thêm ô nhập "WIP Limit" per cột.
  - Board header cột: hiển thị `In Progress (4/5)` — đỏ khi vượt.
  - Khi drag card vào cột đã đầy: cảnh báo confirm trước khi cho phép.

---

### ✅ I8 — Workflow per Task Type

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering (Bug vs Feature), HR (Leave vs Onboarding)
- **Vấn đề hiện tại:**
  Chỉ 1 workflow duy nhất cho toàn dự án. Bug cần quy trình khác Feature.
- **Phương án:**

  ```sql
  -- Trong projects.statuses JSON, thêm workflows[]
  -- {
  --   workflows: [
  --     { id: "wf_1", name: "Default", applies_to: ["task"], transitions: [...] },
  --     { id: "wf_2", name: "Bug Flow", applies_to: ["bug"], transitions: [...] }
  --   ]
  -- }
  ```

  **Frontend:**
  - Workflow Editor: dropdown chọn "Áp dụng cho loại task nào".
  - Khi đổi trạng thái task: backend xác định workflow dựa trên `task.type`.

---

## 🟡 P2 — Medium Priority

---

### ✅ I9 — Time Budget & Cost Tracking

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Finance, Project Management, C-level
- **Vấn đề hiện tại:**
  Có bấm giờ nhưng không có budget giờ, không tính chi phí theo hourly rate, không cảnh báo vượt estimate.
- **Phương án:**

  ```sql
  -- Thêm hourly_rate vào project_members
  ALTER TABLE project_members ADD COLUMN hourly_rate DECIMAL(10,2) NULL;

  -- Thêm budget_hours vào tasks
  ALTER TABLE tasks ADD COLUMN budget_hours DECIMAL(8,2) NULL;

  -- Thêm budget_hours vào projects
  ALTER TABLE projects ADD COLUMN budget_hours DECIMAL(10,2) NULL;
  ALTER TABLE projects ADD COLUMN budget_amount DECIMAL(15,2) NULL;
  ```

  **Logic:**
  - Cảnh báo khi task vượt 80% `budget_hours`.
  - Cost = Σ(`time_entries.duration` × `project_members.hourly_rate`).
  - Analytics: biểu đồ Budget vs Actual theo từng dự án.

---

### ✅ I10 — Required Custom Fields & Conditional Logic

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Sales (không close thiếu giá trị), Finance, Legal
- **Vấn đề hiện tại:**
  Custom fields không có validation, không thể đặt bắt buộc theo điều kiện.
- **Phương án:**

  ```sql
  -- Mở rộng custom_fields
  ALTER TABLE custom_fields ADD COLUMN is_required BOOLEAN DEFAULT false;
  ALTER TABLE custom_fields ADD COLUMN required_on_status VARCHAR(255) NULL;
  -- VD: required_on_status = "done" → chỉ bắt buộc khi task chuyển sang Done
  ALTER TABLE custom_fields ADD COLUMN show_when_field_id BIGINT NULL;
  ALTER TABLE custom_fields ADD COLUMN show_when_value VARCHAR(255) NULL;
  -- Conditional: field này chỉ hiện khi field khác = giá trị nào đó
  ```

  **Frontend:**
  - Custom Field Settings: toggle "Bắt buộc" + chọn "Bắt buộc khi chuyển sang trạng thái".
  - Workflow validation: trước khi cho phép transition, kiểm tra required fields.
  - Guided dialog khi bị chặn: "Cần điền: [Field A], [Field B] trước khi chuyển sang Done".

---

### ✅ I11 — Guided Transition Dialog (Workflow-aware UX)

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Tất cả người dùng
- **Vấn đề hiện tại:**
  Khi transition bị chặn bởi workflow rule, chỉ hiện toast lỗi chung chung. User không biết làm gì.
- **Phương án:**

  **Frontend — Modal "Hoàn tất trước khi chuyển":**
  ```
  ┌─────────────────────────────────────────┐
  │ ⚠️  Cần hoàn tất trước khi chuyển sang "DONE"  │
  ├─────────────────────────────────────────┤
  │ ❌ Chưa điền "Link Merge Request"       │
  │ ❌ Checklist chưa hoàn thành (2/5)      │
  │ ✅ Đã có người review                  │
  ├─────────────────────────────────────────┤
  │ [Điền ngay →]           [Hủy]          │
  └─────────────────────────────────────────┘
  ```
  - Mỗi mục có nút shortcut đến đúng field cần điền.
  - Sau khi điền xong → tự động retry transition.

---

### ✅ I12 — 360° Evaluation & Self-assessment

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** HR, C-level
- **Vấn đề hiện tại:**
  Đánh giá 1 chiều (Manager → Nhân viên), chỉ tính từ task completion rate. Thiếu self-assessment và peer review.
- **Phương án:**

  ```sql
  -- Thêm bảng evaluation_reviews
  CREATE TABLE evaluation_reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    evaluation_id BIGINT NOT NULL,
    reviewer_id INT NOT NULL,
    type ENUM('self', 'peer', 'manager') NOT NULL,
    score_quality FLOAT NULL,
    score_communication FLOAT NULL,
    score_teamwork FLOAT NULL,
    comment TEXT NULL,
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );
  ```

  **Flow:**
  1. Manager tạo kỳ đánh giá → hệ thống gửi thông báo yêu cầu self-assessment.
  2. Nhân viên điền self-assessment (deadline cụ thể).
  3. Manager chỉ định peer reviewer (1-3 đồng nghiệp).
  4. Peer reviewer điền form → Manager tổng hợp → Publish.

---

### ✅ I13 — Advanced Analytics: Burndown & Cycle Time

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Engineering, Product, C-level
- **Vấn đề hiện tại:**
  Analytics chỉ có snapshot tĩnh. Không có velocity tracking, không biết bottleneck ở đâu.
- **Phương án:**

  ```sql
  -- Thêm bảng task_status_history (snapshot mỗi lần đổi trạng thái)
  CREATE TABLE task_status_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    from_status VARCHAR(255) NULL,
    to_status VARCHAR(255) NOT NULL,
    changed_by INT NOT NULL,
    changed_at TIMESTAMP NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
  ```

  **Metrics tính từ bảng này:**
  - **Cycle Time** = thời gian từ `In Progress` → `Done` (trung bình per project).
  - **Lead Time** = thời gian từ `Created` → `Done`.
  - **Throughput** = số task Done per tuần.
  - **Burndown** = tổng task còn lại vs thời gian theo milestone.

  **Frontend:**
  - Analytics thêm tab "Hiệu suất quy trình" với 4 metric cards + Burndown chart.

---

### ✅ I14 — Audit Log / Compliance

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Finance, Legal, C-level, IT Security
- **Vấn đề hiện tại:**
  Không trace được ai xóa dự án, ai thay đổi workflow, ai sửa custom field value. Không đáp ứng compliance.
- **Phương án:**

  ```sql
  CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    actor_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,   -- 'project.delete', 'workflow.update', 'task.assign'
    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT NOT NULL,
    before_value JSON NULL,
    after_value JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (actor_id) REFERENCES users(id)
  );
  ```

  **Frontend:**
  - Settings > Audit Log: bảng lọc theo user / action / thời gian.
  - Xuất CSV audit log.

---

## 🔵 P3 — Nice to Have

---

### ✅ I15 — Guest / External Access

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Sales (chia sẻ với khách hàng), Ops (freelancer)
- **Vấn đề hiện tại:**
  Không mời người ngoài xem task/project mà không cấp quyền toàn hệ thống.
- **Phương án:**
  - Thêm `role: guest` — chỉ xem project/task được chia sẻ cụ thể.
  - `share_links` table: link có expiry, có thể set password.
  - Guest chỉ có thể comment, không sửa được task core fields.

---

### ✅ I16 — Smart Notification Digest & Snooze

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Tất cả
- **Vấn đề hiện tại:**
  Thông báo dồn vào Inbox, không có cách gom nhóm hay hoãn lại.
- **Phương án:**
  - Digest email: gộp tất cả thông báo trong ngày → gửi 1 email lúc 8h sáng.
  - Snooze notification: "Nhắc lại sau 2 giờ / Ngày mai / Tuần tới".
  - Priority levels: mention của Manager = quan trọng hơn reaction emoji.
  - `@team` / `@phongban` để ping cả nhóm trong comment.

---

### ✅ I17 — Pipeline View cho Sales

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** Sales, Business Development
- **Vấn đề hiện tại:**
  Kanban Board hiện tại là task-centric, không phù hợp với deal/opportunity pipeline của Sales.
- **Phương án:**
  - Thêm Project Template "Sales Pipeline" với view mode riêng.
  - Mỗi card = 1 deal với value (giá trị), probability (%), expected close date.
  - Column = stage trong pipeline (Prospect → Qualified → Proposal → Negotiation → Won/Lost).
  - Summary row dưới mỗi cột: tổng value deals đang trong stage đó.

---

### ✅ I18 — SLA Tracking & Auto-escalation

- **Checkbox:** `[ ]`
- **Phòng ban hưởng lợi:** IT Support, Customer Success, Operations
- **Vấn đề hiện tại:**
  Không có SLA (Service Level Agreement) — cam kết giải quyết task trong bao lâu theo priority.
- **Phương án:**
  ```sql
  CREATE TABLE sla_policies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    priority VARCHAR(50) NOT NULL,      -- urgent, high, medium, low
    response_hours INT NOT NULL,        -- thời gian phải nhận task
    resolution_hours INT NOT NULL,      -- thời gian phải hoàn thành
    escalate_to_user_id INT NULL,       -- escalate lên ai khi vi phạm
    created_at TIMESTAMP
  );
  ```

  **Logic:**
  - Cron job kiểm tra task gần vi phạm SLA → cảnh báo assignee.
  - Vi phạm SLA → tự động escalate, gửi thông báo Manager.
  - Analytics: SLA compliance rate per team.

---

## 📊 Tóm tắt tiến độ

| Priority | Tổng | Đã xong | Còn lại |
|----------|------|---------|---------|
| 🔴 P0 Critical | 4 | 0 | 4 |
| 🟠 P1 High | 4 | 0 | 4 |
| 🟡 P2 Medium | 6 | 0 | 6 |
| 🔵 P3 Low | 4 | 0 | 4 |
| **Tổng** | **18** | **0** | **18** |

---

## 🗓 Gợi ý lộ trình thực hiện

```
Tháng 1 — Foundation
  [P0] I1: Multi-assignee
  [P0] I4: Task Templates
  [P0] I3: Recurring Tasks

Tháng 2 — Core Workflow
  [P0] I2: Task Dependencies
  [P1] I7: WIP Limits
  [P2] I11: Guided Transition Dialog
  [P2] I10: Required Custom Fields

Tháng 3 — Planning & Tracking
  [P1] I5: Milestones
  [P1] I6: Epic Hierarchy
  [P2] I9: Time Budget & Cost
  [P2] I13: Burndown & Cycle Time

Tháng 4 — Scale & Compliance
  [P1] I8: Workflow per Task Type
  [P2] I12: 360° Evaluation
  [P2] I14: Audit Log

Tháng 5+ — Expansion
  [P3] I15: Guest Access
  [P3] I16: Smart Notifications
  [P3] I17: Sales Pipeline View
  [P3] I18: SLA Tracking
```

---

*Tài liệu này là living document — cập nhật checkbox khi hoàn thành từng item.*
*Tham chiếu chi tiết tính năng hiện có: [TASKFLOW_FEATURES.md](./TASKFLOW_FEATURES.md)*
*Tham chiếu kiến trúc kỹ thuật: [TASKFLOW_TECH_SPEC.md](./TASKFLOW_TECH_SPEC.md)*
