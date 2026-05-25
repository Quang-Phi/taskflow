# 📋 TaskFlow – Hệ Thống Quản Lý Công Việc

> **Stack**: ReactJS (TypeScript) + Laravel 11 + MySQL + SCSS + Ant Design

---

## 1. TỔNG QUAN DỰ ÁN

### Mục tiêu
Xây dựng hệ thống quản lý công việc (Task Management) dành cho doanh nghiệp, hỗ trợ:
- Quản lý dự án và công việc theo nhóm/phòng ban
- Giao task từ Manager → Employee theo phân cấp
- Đánh giá nhân viên dựa trên hiệu suất hoàn thành task
- Báo cáo thống kê và dashboard trực quan

### Vai trò người dùng (Roles)
| Role | Quyền hạn |
|------|-----------|
| **Super Admin** | Quản lý toàn hệ thống, tất cả permissions |
| **Manager** | Tạo dự án, giao task, đánh giá nhân viên trong team |
| **Employee** | Nhận task, cập nhật tiến độ, xem đánh giá cá nhân |

---

## 2. CÁC CHỨC NĂNG CHI TIẾT

### 2.1. 🔐 XÁC THỰC & PHÂN QUYỀN

#### Đăng nhập
1. User nhập email + password → nhấn **"Đăng nhập"**
2. Gọi API `POST /api/auth/login`
3. Đúng → nhận JWT token → lưu `localStorage` → redirect Dashboard
4. Sai → toast lỗi "Email hoặc mật khẩu không đúng"

#### Đăng xuất
- Nhấn avatar → **"Đăng xuất"** → xóa token → redirect Login

#### Đổi mật khẩu
- Cài đặt cá nhân → tab Bảo mật → nhập mật khẩu cũ/mới → **"Lưu"**

---

### 2.2. 👥 QUẢN LÝ NGƯỜI DÙNG

#### Danh sách nhân viên
- Table: Avatar, Tên, Email, Role, Phòng ban, Trạng thái, Hành động
- Tìm kiếm realtime theo tên/email
- Filter: Role, Phòng ban, Trạng thái
- **"+ Thêm nhân viên"** → Modal nhập thông tin
- Icon ✏️ Sửa | 🚫 Vô hiệu hóa | 🗑️ Xóa (đều có Confirm dialog)

#### Chi tiết nhân viên (tabs)
- **Thông tin cá nhân**: tên, email, phone, avatar, phòng ban
- **Task đang làm**: danh sách task được giao
- **Lịch sử đánh giá**: các kỳ đánh giá và điểm
- **Thống kê hiệu suất**: chart tỉ lệ hoàn thành theo tháng

#### Quản lý phòng ban
- CRUD phòng ban, gán nhân viên, thiết lập Manager

---

### 2.3. 📁 QUẢN LÝ DỰ ÁN

#### Danh sách dự án
- Hiển thị dạng Card Grid hoặc Table (toggle)
- Mỗi card: tên, mô tả, tiến độ %, deadline, số thành viên, trạng thái
- **"+ Tạo dự án"** → modal tạo mới

#### Tạo dự án
- Form: Tên, Mô tả (rich text), Ngày bắt đầu/kết thúc, Thành viên (multi-select), Màu, Priority
- Nhấn **"Tạo dự án"** → redirect vào trang chi tiết

#### Chi tiết dự án (tabs)
- **Kanban Board**: kéo thả task qua Todo / In Progress / Review / Done
- **Danh sách task**: table view
- **Thành viên**: danh sách member + phân quyền
- **Hoạt động**: timeline sự kiện
- **Cài đặt**: chỉnh sửa thông tin (chỉ Manager/Admin)

---

### 2.4. ✅ QUẢN LÝ TASK

#### Tạo task
- Từ board: nhấn **"+ Thêm task"** trong cột → quick-create form
- Từ nút chính: **"Tạo task"** → modal đầy đủ
- **Form**: Tiêu đề, Mô tả (rich text), Dự án, Assignee, Priority, Ngày bắt đầu/Deadline, Labels, Estimated hours, Checklist, File đính kèm

#### Giao task (Manager → Employee)
1. Manager vào task → nhấn **"Giao task"** hoặc đổi Assignee
2. Chọn nhân viên trong dropdown
3. Nhấn **"Xác nhận giao"**
4. Hệ thống: cập nhật assignee + gửi thông báo + ghi log

#### Cập nhật tiến độ (Employee)
- Thay đổi Status (Todo → In Progress → Done)
- Cập nhật % hoàn thành (slider 0-100%)
- Thêm comment/nhật ký công việc
- Upload file kết quả → nhấn **"Cập nhật"** → notify Manager

#### Chi tiết task
- **Panel trái**: Tiêu đề (editable inline), Mô tả, Checklist, File, Comments, Activity log
- **Panel phải**: Status, Priority, Assignee, Deadline, Estimated/Actual hours, Labels

#### Kanban Board
- 4 cột: Todo | In Progress | Review | Done
- Drag & drop task → tự động cập nhật status
- Click task → mở modal chi tiết
- Filter: theo assignee, priority, label, deadline

---

### 2.5. 🔔 THÔNG BÁO

- Bell icon ở header → dropdown thông báo chưa đọc
- Loại: task được giao, sắp deadline, có comment, bị đánh giá, dự án cập nhật
- Click thông báo → navigate đến màn hình liên quan
- **"Đánh dấu tất cả đã đọc"**

---

### 2.6. ⭐ ĐÁNH GIÁ NHÂN VIÊN

#### Công thức điểm tự động
| Tiêu chí | Trọng số |
|----------|----------|
| Tỉ lệ hoàn thành task đúng hạn | 40% |
| Số task hoàn thành trong kỳ | 30% |
| Chất lượng (Manager chấm thủ công) | 30% |

#### Tạo kỳ đánh giá (Manager)
1. Menu **"Đánh giá"** → **"+ Tạo kỳ đánh giá"**
2. Chọn khoảng thời gian (ví dụ: Tháng 5/2026)
3. Hệ thống tự tổng hợp dữ liệu task → hiển thị điểm gợi ý

#### Đánh giá chi tiết từng nhân viên
- Click vào tên nhân viên → màn hình đánh giá chi tiết:
  - **Thống kê task**: tổng/hoàn thành/đúng hạn/trễ + bảng từng task
  - **Tiêu chí chấm điểm** (1-10): Chất lượng, Trách nhiệm, Giao tiếp, Sáng tạo, Chấp hành
  - **Nhận xét tổng quát** (free text)
  - **Điểm tổng** (tự tính) + **Xếp loại**: Xuất sắc / Tốt / Khá / Trung bình / Yếu
- Nhấn **"Lưu đánh giá"** → gửi thông báo cho nhân viên

#### Xem đánh giá cá nhân (Employee)
- Menu **"Đánh giá của tôi"** → danh sách kỳ → click xem chi tiết
- Chỉ đọc: điểm từng tiêu chí, nhận xét Manager, thống kê task, xếp loại

---

### 2.7. 📊 DASHBOARD & BÁO CÁO

#### Dashboard Admin/Manager
- Tổng: dự án đang chạy, task, task trễ, nhân viên active
- Bar chart: tiến độ dự án theo tháng
- Pie chart: phân bổ task theo trạng thái
- Top nhân viên hiệu suất cao
- Danh sách task sắp deadline (7 ngày tới)

#### Dashboard Employee
- Task được giao hôm nay
- Task sắp deadline
- Tiến độ cá nhân (% task hoàn thành tháng này)
- Điểm đánh giá kỳ gần nhất

#### Báo cáo
- Báo cáo dự án: tổng task, hoàn thành, đúng/trễ hạn, Gantt chart
- Báo cáo nhân viên: thống kê theo khoảng thời gian
- Xuất Excel/PDF

---

## 3. DATABASE SCHEMA

```sql
users: id, name, email, password, avatar, phone, department_id, role, status

departments: id, name, description, manager_id

projects: id, name, description, color, priority, status, start_date, end_date, created_by

project_members: id, project_id, user_id, role(manager/member), joined_at

tasks: id, project_id, title, description, status, priority, assignee_id, creator_id,
       estimated_hours, actual_hours, start_date, due_date, completed_at,
       parent_task_id, position

labels: id, name, color, project_id
task_labels: task_id, label_id

task_comments: id, task_id, user_id, content

task_attachments: id, task_id, file_name, file_path, file_size, uploaded_by

task_activities: id, task_id, user_id, action, old_value, new_value

evaluation_periods: id, name, start_date, end_date, status, created_by

evaluations: id, period_id, evaluator_id, employee_id,
             score_quality, score_responsibility, score_communication,
             score_creativity, score_discipline,
             task_completion_rate, total_tasks, completed_tasks, overdue_tasks,
             total_score, rating, comment, status(draft/published)

notifications: id, user_id, type, title, message, data(JSON), is_read
```

---

## 4. API ENDPOINTS

```
# Auth
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/password

# Users & Departments
GET|POST       /api/users
GET|PUT|DELETE /api/users/{id}
GET|POST       /api/departments
PUT|DELETE     /api/departments/{id}

# Projects
GET|POST       /api/projects
GET|PUT|DELETE /api/projects/{id}
POST|DELETE    /api/projects/{id}/members

# Tasks
GET|POST       /api/tasks
GET|PUT|DELETE /api/tasks/{id}
PUT            /api/tasks/{id}/status
PUT            /api/tasks/{id}/assign
POST           /api/tasks/{id}/comments
GET            /api/tasks/{id}/activities

# Evaluations
GET|POST       /api/evaluation-periods
GET            /api/evaluation-periods/{id}/evaluations
GET|POST       /api/evaluations
GET|PUT        /api/evaluations/{id}
GET            /api/evaluations/me

# Dashboard & Reports
GET  /api/dashboard/summary
GET  /api/reports/projects
GET  /api/reports/employees

# Notifications
GET  /api/notifications
PUT  /api/notifications/read-all
PUT  /api/notifications/{id}/read
```

---

## 5. KẾ HOẠCH TRIỂN KHAI

### Phase 1 – Nền tảng (Tuần 1-2)
- [ ] Setup project FE (React + Redux + Ant Design + SCSS)
- [ ] Setup project BE (Laravel + Sanctum + Spatie Permission)
- [ ] Database migrations cơ bản
- [ ] Auth: Login/Logout/JWT
- [ ] Layout: Sidebar, Header, Routing
- [ ] Quản lý User & Phòng ban

### Phase 2 – Core Features (Tuần 3-5)
- [ ] Quản lý Dự án (CRUD + Members)
- [ ] Quản lý Task (CRUD full)
- [ ] Kanban Board (drag & drop)
- [ ] Giao task Manager → Employee
- [ ] Hệ thống thông báo

### Phase 3 – Đánh giá (Tuần 6-7)
- [ ] Tạo & quản lý kỳ đánh giá
- [ ] Đánh giá chi tiết nhân viên
- [ ] Tự động tổng hợp điểm từ task
- [ ] Giao diện xem đánh giá (Employee)

### Phase 4 – Dashboard & Báo cáo (Tuần 8)
- [ ] Dashboard tổng quan (3 role)
- [ ] Biểu đồ thống kê (Recharts)
- [ ] Xuất báo cáo Excel/PDF

### Phase 5 – Hoàn thiện (Tuần 9-10)
- [ ] UI/UX polish & responsive
- [ ] Testing (Unit + Feature)
- [ ] Performance optimization

---

## 6. CÔNG NGHỆ SỬ DỤNG

| Lớp | Công nghệ |
|-----|-----------|
| FE Framework | React 18 + TypeScript |
| UI Library | Ant Design (antd) |
| Styling | SCSS Modules |
| State | Redux Toolkit + RTK Query |
| HTTP | Axios |
| DnD | @dnd-kit/core |
| Rich Text | TipTap |
| Charts | Recharts |
| BE Framework | Laravel 11 |
| Auth | Laravel Sanctum |
| Authorization | Spatie Laravel Permission |
| Database | MySQL 8.0 |

---

## 7. SETUP NHANH

```bash
# BACKEND (cần PHP 8.2 + Composer)
cd taskflow-be
composer install
cp .env.example .env
php artisan key:generate
# Tạo DB MySQL: taskflow
php artisan migrate --seed
php artisan serve   # → http://localhost:8000

# FRONTEND
cd taskflow-fe
npm install
npm start           # → http://localhost:3000
```

---

*Cập nhật: 2026-05-21*
