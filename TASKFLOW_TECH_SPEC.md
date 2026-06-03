# 📋 TaskFlow – Tài liệu Kỹ thuật & Kiến trúc Hệ thống (Technical Specification)

---

## 1. TECH STACK & KIẾN TRÚC HỆ THỐNG

Hệ thống TaskFlow hoạt động dưới dạng một ứng dụng nhúng/tích hợp hoặc chạy độc lập kết nối chặt chẽ với hệ sinh thái Bitrix24 của doanh nghiệp thông qua xác thực OAuth2 & Laravel Sanctum.

- **Frontend**: React 18, TypeScript, Ant Design, SCSS Modules, Axios, Recharts (vẽ biểu đồ báo cáo), `@dnd-kit/core` (cho Kanban board), TipTap (soạn thảo văn bản).
- **Backend**: Laravel 11, Laravel Sanctum (quản lý session/token bảo mật), MySQL 8.0, Pusher/Laravel Echo (cho real-time events).
- **Tích hợp Bitrix24**: Xác thực SSO/OAuth2 đồng bộ người dùng, phòng ban, và ủy thác API thông qua các route proxy.

---

## 2. DATABASE SCHEMA (Cơ sở dữ liệu thực tế)

Bản vẽ thiết kế cơ sở dữ liệu vật lý được ánh xạ trực tiếp từ các Laravel migrations và Eloquent Models hiện tại:

### 2.1 Bảng `users` (Người dùng)

Lưu trữ thông tin người dùng được đồng bộ từ Bitrix24 hoặc tài khoản hệ thống.

- `id` (int, khóa chính, không tự tăng - khớp với Bitrix User ID)
- `bitrix_id` (string, null)
- `name` (string) - Họ tên đầy đủ
- `first_name` (string, null)
- `last_name` (string, null)
- `email` (string, duy nhất)
- `phone` (string, null)
- `photo` (string, null) - Đường dẫn ảnh đại diện
- `department_ids` (json, null) - Danh sách ID phòng ban trực thuộc
- `work_position` (string, null) - Chức danh công việc
- `role` (string) - Vai trò hệ thống (`superadmin`, `admin`, `manager`, `employee`)
- `active` (boolean) - Trạng thái hoạt động
- `theme` (string, default: `dark`) - Giao diện người dùng (`light`, `dark`, `system`)
- `timezone` (string, default: `Asia/Ho_Chi_Minh`)
- `language` (string, default: `vi`) - Ngôn ngữ hiển thị (`vi`, `en`, `ja`)
- `workspace_name` (string, null)
- `notification_settings` (json, null) - Cấu hình bật/tắt nhận từng loại thông báo
- `bitrix_access_token` (text, null)
- `bitrix_refresh_token` (text, null)
- `bitrix_token_expires` (datetime, null)
- `bitrix_domain` (string, null)
- `bitrix_member_id` (string, null)
- `created_at` / `updated_at` (timestamps)

### 2.2 Bảng `projects` (Dự án)

Quản lý các không gian dự án.

- `id` (bigint, khóa chính, tự tăng)
- `name` (string) - Tên dự án
- `description` (text, null) - Mô tả dự án
- `color` (string) - Mã màu nhận diện
- `icon` (string, null) - Tên icon hoặc ảnh base64
- `priority` (string) - Mức độ ưu tiên dự án
- `status` (string) - Trạng thái dự án (`active`, `on_hold`, `completed`, `planning`)
- `statuses` (json, null) - Quy trình trạng thái Kanban tùy chỉnh (VD: To Do, In Progress, Done,...)
- `start_date` (date, null)
- `end_date` (date, null)
- `created_by` (int, khóa ngoại liên kết `users.id`)
- `created_at` / `updated_at` (timestamps)
- `deleted_at` (timestamp, soft delete)

### 2.3 Bảng `project_members` (Thành viên dự án)

Bảng trung gian liên kết nhiều-nhiều giữa dự án và người dùng.

- `id` (bigint, khóa chính, tự tăng)
- `project_id` (bigint, khóa ngoại liên kết `projects.id`)
- `user_id` (int, khóa ngoại liên kết `users.id`)
- `role` (string, default: `member`) - Vai trò trong dự án (`manager`, `member`)
- `joined_at` (timestamp, null)
- `created_at` / `updated_at` (timestamps)

### 2.4 Bảng `tasks` (Công việc)

Quản lý thông tin công việc, hỗ trợ phân cấp subtask.

- `id` (bigint, khóa chính, tự tăng)
- `project_id` (bigint, khóa ngoại liên kết `projects.id`)
- `title` (string) - Tiêu đề task
- `description` (text, null) - Mô tả chi tiết (rich text)
- `status` (string) - Trạng thái hiện tại (Todo, In Progress, Done,...)
- `priority` (string) - Độ ưu tiên (`urgent`, `high`, `medium`, `low`, `none`)
- `type` (string, default: `task`) - Phân loại (`task`, `bug`)
- `assignee_id` (int, null, khóa ngoại liên kết `users.id`) - Người thực hiện
- `creator_id` (int, khóa ngoại liên kết `users.id`) - Người tạo
- `estimated_hours` (decimal, null) - Thời gian ước tính (h)
- `actual_hours` (decimal, null) - Thời gian thực tế (h)
- `start_date` (datetime, null)
- `due_date` (datetime, null) - Hạn chót
- `completed_at` (datetime, null) - Thời điểm hoàn thành thực tế
- `parent_task_id` (bigint, null, liên kết đệ quy `tasks.id`) - ID công việc cha
- `position` (int, default: 0) - Thứ tự hiển thị trên Kanban
- `watcher_ids` (json, null) - Danh sách ID người theo dõi task
- `created_at` / `updated_at` (timestamps)
- `deleted_at` (timestamp, soft delete)

### 2.5 Bảng `checklists` và `checklist_items` (Danh sách kiểm tra)

- **checklists**:
  - `id` (bigint, khóa chính, tự tăng)
  - `task_id` (bigint, khóa ngoại liên kết `tasks.id`)
  - `name` (string) - Tên nhóm checklist
  - `position` (int)
  - `created_at` / `updated_at` (timestamps)
- **checklist_items**:
  - `id` (bigint, khóa chính, tự tăng)
  - `checklist_id` (bigint, khóa ngoại liên kết `checklists.id`)
  - `name` (string) - Nội dung kiểm tra
  - `is_checked` (boolean) - Trạng thái hoàn thành
  - `assignee_id` (int, null, khóa ngoại `users.id`) - Người được gán kiểm tra
  - `position` (int)
  - `created_at` / `updated_at` (timestamps)

### 2.6 Bảng `custom_fields` và `custom_field_values` (Trường dữ liệu động)

- **custom_fields**:
  - `id` (bigint, khóa chính, tự tăng)
  - `project_id` (bigint, khóa ngoại `projects.id`)
  - `name` (string) - Tên trường
  - `type` (string) - Loại dữ liệu (`text`, `number`, `date`, `dropdown`, `checkbox`)
  - `options` (json, null) - Các giá trị lựa chọn (nếu là dropdown)
  - `created_at` / `updated_at` (timestamps)
- **custom_field_values**:
  - `id` (bigint, khóa chính, tự tăng)
  - `task_id` (bigint, khóa ngoại `tasks.id`)
  - `custom_field_id` (bigint, khóa ngoại `custom_fields.id`)
  - `value` (text) - Giá trị lưu trữ
  - `created_at` / `updated_at` (timestamps)

### 2.7 Bảng `time_entries` (Nhật ký thời gian)

Lưu trữ nhật ký bấm giờ tự động hoặc log giờ thủ công.

- `id` (bigint, khóa chính, tự tăng)
- `task_id` (bigint, khóa ngoại `tasks.id`)
- `user_id` (int, khóa ngoại `users.id`)
- `started_at` (datetime) - Thời điểm bắt đầu
- `ended_at` (datetime, null) - Thời điểm kết thúc
- `duration` (int, null) - Thời lượng làm việc tính bằng giây
- `description` (text, null) - Ghi chú công việc
- `created_at` / `updated_at` (timestamps)

### 2.8 Bảng `task_comments` và `comment_reactions` (Thảo luận)

- **task_comments**:
  - `id` (bigint, khóa chính, tự tăng)
  - `task_id` (bigint, khóa ngoại `tasks.id`)
  - `user_id` (int, khóa ngoại `users.id`)
  - `parent_id` (bigint, null, liên kết đệ quy `task_comments.id`) - ID bình luận cha (cho luồng replies)
  - `comment` (text) - Nội dung bình luận
  - `attachment_path` (string, null)
  - `created_at` / `updated_at` (timestamps)
- **comment_reactions**:
  - `id` (bigint, khóa chính, tự tăng)
  - `comment_id` (bigint, khóa ngoại `task_comments.id`)
  - `user_id` (int, khóa ngoại `users.id`)
  - `reaction` (string) - Loại reaction (like, love, haha,...)
  - `created_at` / `updated_at` (timestamps)

### 2.9 Bảng `evaluations` (Đánh giá hiệu suất)

Lưu trữ kết quả đánh giá hiệu suất nhân viên theo kỳ.

- `id` (bigint, khóa chính, tự tăng)
- `period` (string) - Kỳ đánh giá (định dạng `YYYY-MM`)
- `employee_id` (int, khóa ngoại `users.id`)
- `evaluator_id` (int, khóa ngoại `users.id`)
- `total_tasks` (int) - Tổng số task được giao trong kỳ
- `completed_tasks` (int) - Số task đã hoàn thành trong kỳ
- `on_time_tasks` (int) - Số task hoàn thành đúng hạn
- `on_time_rate` (float) - Tỉ lệ hoàn thành đúng hạn (%)
- `score_quality` (float) - Điểm chất lượng công việc (1-10)
- `score_responsibility` (float) - Điểm tinh thần trách nhiệm (1-10)
- `score_communication` (float) - Điểm giao tiếp phối hợp (1-10)
- `score_creativity` (float) - Điểm sáng tạo đổi mới (1-10)
- `score_discipline` (float) - Điểm chấp hành quy định (1-10)
- `total_score` (float) - Điểm tổng kết (tính toán dựa trên công thức cấu hình 50% đúng hạn, 50% hoàn thành của kỳ)
- `comment` (text, null) - Nhận xét chi tiết của người đánh giá
- `status` (string, default: `draft`) - Trạng thái (`draft`, `published`)
- `published_at` (datetime, null)
- `created_at` / `updated_at` (timestamps)

### 2.10 Bảng `notifications` (Thông báo)

- `id` (bigint, khóa chính, tự tăng)
- `user_id` (int, khóa ngoại `users.id`) - Người nhận thông báo
- `actor_id` (int, null, khóa ngoại `users.id`) - Người thực hiện hành động tạo ra thông báo
- `type` (string) - Loại thông báo (`task_assigned`, `comment`, `deadline`, `evaluation`, `project_update`,...)
- `action` (string) - Mô tả hành động (ví dụ: "commented on", "assigned")
- `target` (string) - Đối tượng chịu tác động
- `extra` (string, null)
- `task_id` (bigint, null, khóa ngoại `tasks.id`)
- `project_id` (bigint, null, khóa ngoại `projects.id`)
- `read` (boolean, default: false) - Trạng thái đã đọc
- `created_at` / `updated_at` (timestamps)

### 2.11 Bảng `status_templates` (Mẫu trạng thái Kanban)

Lưu trữ các mẫu trạng thái Kanban tạo sẵn.

- `id` (bigint, khóa chính, tự tăng)
- `name` (string) - Tên mẫu
- `statuses` (json) - Mảng các trạng thái đi kèm
- `created_at` / `updated_at` (timestamps)

---

## 3. DANH SÁCH API ENDPOINTS

Tất cả các API được bảo vệ bởi middleware `auth:sanctum` (ngoại trừ API callback Bitrix):

### 3.1 Authentication & Profile

- `POST /api/callback`: Callback OAuth2 công khai đồng bộ tài khoản Bitrix và trả về token Sanctum.
- `GET /api/auth/me`: Lấy thông tin tài khoản hiện tại.
- `POST /api/auth/logout`: Đăng xuất và thu hồi token Sanctum hiện tại.
- `PUT /api/auth/settings`: Cập nhật cấu hình người dùng (theme, timezone, language, workspace name).

### 3.2 Users & Bitrix Integration

- `GET /api/users`: Lấy danh sách thành viên nội bộ.
- `GET /api/bitrix/users`: Lấy danh sách nhân viên từ Bitrix24 (API Proxy).
- `GET /api/bitrix/users/{id}`: Xem chi tiết thông tin nhân viên trên Bitrix24.
- `PUT /api/bitrix/users/{id}`: Cập nhật thông tin nhân viên Bitrix24.
- `GET /api/bitrix/departments`: Lấy danh sách phòng ban từ Bitrix24.
- `GET /api/bitrix/custom`: Route proxy cho các API ngoài của Bitrix24.

### 3.3 Projects

- `GET /api/projects`: Xem danh sách dự án (phân trang + tìm kiếm).
- `POST /api/projects`: Tạo dự án mới.
- `GET /api/projects/{id}`: Xem chi tiết dự án.
- `PUT /api/projects/{id}`: Cập nhật thông tin dự án.
- `DELETE /api/projects/{id}`: Xóa dự án (Soft delete).
- `POST /api/projects/{id}/members`: Mời thành viên tham gia dự án.
- `DELETE /api/projects/{id}/members/{userId}`: Xóa thành viên khỏi dự án.
- `PUT /api/projects/{id}/statuses`: Cập nhật quy trình trạng thái Kanban tùy chỉnh của dự án.
- `GET /api/projects/{id}/time-entries`: Thống kê nhật ký giờ làm của dự án.
- `GET /api/status-templates`: Xem danh sách mẫu trạng thái Kanban.
- `POST /api/status-templates`: Tạo mẫu trạng thái mới.
- `DELETE /api/status-templates/{id}`: Xóa mẫu trạng thái.

### 3.4 Tasks

- `GET /api/tasks`: Lấy danh sách công việc.
- `POST /api/tasks`: Tạo công việc mới.
- `GET /api/tasks/{id}`: Xem chi tiết công việc.
- `PUT /api/tasks/{id}`: Cập nhật công việc.
- `DELETE /api/tasks/{id}`: Xóa công việc (Soft delete).
- `PUT /api/tasks/{id}/status`: Cập nhật nhanh trạng thái công việc.
- `GET /api/tasks/{id}/comments`: Xem danh sách bình luận của công việc.
- `POST /api/tasks/{id}/comments`: Đăng bình luận mới.
- `POST /api/comments/{id}/react`: Thả reaction cho bình luận.
- `GET /api/tasks/{id}/activities`: Lấy nhật ký lịch sử thay đổi của công việc.
- `POST /api/tasks/{id}/watch`: Đăng ký/Hủy đăng ký theo dõi công việc.
- `POST /api/tasks/{id}/timer/start`: Bắt đầu tính giờ tự động cho công việc.
- `POST /api/tasks/{id}/timer/stop`: Dừng tính giờ tự động và lưu log.
- `POST /api/tasks/{id}/time-entries`: Tạo bản ghi log giờ thủ công.
- `DELETE /api/time-entries/{id}`: Xóa bản ghi log giờ.
- `GET /api/me/timer/running`: Kiểm tra xem hiện có công việc nào đang chạy bộ đếm giờ không.
- `GET /api/me/time-entries/today`: Lấy danh sách log giờ trong ngày của bản thân.
- `GET /api/time-entries`: Danh sách chi tiết logs giờ của dự án/thành viên.

### 3.5 AI Assistant (Trợ lý AI)

- `POST /api/tasks/{id}/ai/checklist`: AI tự động tạo danh sách kiểm tra dựa trên nội dung task.
- `POST /api/tasks/{id}/ai/subtasks`: AI tự động tạo danh sách công việc con.
- `POST /api/tasks/{id}/ai/description`: AI viết/tóm tắt mô tả công việc.
- `POST /api/tasks/{id}/ai/chat`: Chat trực tiếp với AI trợ lý trong ngữ cảnh công việc cụ thể.
- `POST /api/ai/global/chat`: Chat AI toàn cục (không cần ngữ cảnh task).

### 3.6 Custom Fields (Trường tùy chỉnh)

- `GET /api/projects/{projectId}/custom-fields`: Lấy danh sách trường tùy chỉnh của dự án.
- `POST /api/projects/{projectId}/custom-fields`: Tạo trường tùy chỉnh mới.
- `DELETE /api/custom-fields/{id}`: Xóa trường tùy chỉnh.
- `POST /api/tasks/{taskId}/custom-field-values`: Cập nhật giá trị trường tùy chỉnh cho công việc.

### 3.7 Checklists & Items

- `POST /api/tasks/{taskId}/checklists`: Tạo nhóm checklist mới.
- `PUT /api/checklists/{id}`: Cập nhật tên hoặc vị trí nhóm checklist.
- `DELETE /api/checklists/{id}`: Xóa nhóm checklist.
- `POST /api/checklists/{checklistId}/items`: Tạo phần tử kiểm tra mới.
- `PUT /api/checklist-items/{id}`: Cập nhật nội dung, trạng thái checkbox, người được gán của phần tử.
- `DELETE /api/checklist-items/{id}`: Xóa phần tử kiểm tra.
- `POST /api/checklist-items/{id}/convert`: Chuyển đổi một checklist item thành công việc con (subtask) hoặc công việc độc lập.

### 3.8 Attachments (Tệp đính kèm)

- `POST /api/tasks/{taskId}/attachments`: Tải tệp đính kèm lên công việc.
- `PUT /api/attachments/{id}`: Đổi tên tệp đính kèm.
- `DELETE /api/attachments/{id}`: Xóa tệp đính kèm.

### 3.9 Evaluations & Performance (Đánh giá & Hiệu suất)

- `GET /api/evaluations`: Lấy danh sách các bản ghi đánh giá (Manager/Admin hoặc cá nhân).
- `POST /api/evaluations/generate`: Tự động tính toán điểm hiệu suất gợi ý của nhân viên theo kỳ.
- `GET /api/evaluations/{id}`: Xem chi tiết kết quả đánh giá.
- `PUT /api/evaluations/{id}`: Lưu nháp hoặc Công bố kết quả đánh giá (chỉ Manager/Admin).

### 3.10 Notifications & Search

- `GET /api/notifications`: Lấy danh sách thông báo của người dùng.
- `POST /api/notifications/read`: Đánh dấu một hoặc tất cả thông báo đã đọc.
- `GET /api/notifications/unread-count`: Đếm số lượng thông báo chưa đọc.
- `GET /api/search`: Tìm kiếm toàn cục (Tasks, Projects, Members).

---

## 4. QUY TRÌNH XÁC THỰC SSO & TÍCH HỢP BITRIX24

Ứng dụng sử dụng cơ chế Single Sign-On (SSO) nhúng trực tiếp qua Bitrix24 Application IFrame:

1. **Bước 1**: Người dùng mở ứng dụng từ bên trong giao diện Bitrix24.
2. **Bước 2**: Bitrix24 gửi một yêu cầu HTTP POST kèm dữ liệu chữ ký và mã xác thực (`AUTH_ID`) đến endpoint `/api/callback` của Laravel backend.
3. **Bước 3**: Backend Laravel tiếp nhận, xác minh tính hợp lệ của chữ ký với server Bitrix24.
4. **Bước 4**:
   - Nếu người dùng chưa tồn tại cục bộ: Tự động tải thông tin cá nhân của người dùng từ API Bitrix24 (`user.current`) để tạo mới tài khoản trong bảng `users` cục bộ.
   - Nếu đã tồn tại: Cập nhật `access_token` và `refresh_token` mới nhất của Bitrix.
5. **Bước 5**: Backend sinh ra một Sanctum Token mới và trả về cho React Frontend.
6. **Bước 6**: React Frontend lưu Sanctum Token vào localStorage và gắn vào header `Authorization: Bearer <token>` trong mọi request API tiếp theo gửi đến Laravel.

---

## 5. KẾ HOẠCH TRIỂN KHAI PHÁT TRIỂN (DEVELOPMENT PLAN)

Kế hoạch này được cập nhật chính xác theo các tính năng thực tế đã hoàn thành:

### 5.1 Giai đoạn 1: Thiết lập nền tảng & Tích hợp Bitrix (Hoàn thành)
- Cấu hình Laravel Sanctum, CORS kết nối chéo Frontend-Backend.
- Xây dựng Module Callback xác thực SSO từ Bitrix24 IFrame.
- Đồng bộ tự động danh sách phòng ban và người dùng từ Bitrix.

### 5.2 Giai đoạn 2: Core Task & Kanban Project (Hoàn thành)
- Xây dựng cơ sở dữ liệu và API CRUD dự án, thành viên dự án và công việc.
- Phát triển bảng Kanban kéo thả realtime mượt mà, lưu vị trí và cập nhật trạng thái tự động.
- Triển khai tính năng Custom Statuses giúp dự án linh hoạt quy trình cột.

### 5.3 Giai đoạn 3: Theo dõi thời gian & Bảng công tuần (Hoàn thành)
- Triển khai bộ đếm giờ (Time Tracker) tự động bắt đầu/dừng ghi nhận DB.
- Phát triển giao diện ma trận Bảng công tuần (Weekly Timesheet) cho phép nhập giờ lưới và thống kê thời lượng thực hiện.
- Hỗ trợ log giờ thủ công thông qua popover và modal.

### 5.4 Giai đoạn 4: Đánh giá hiệu suất & Phân tích Recharts (Hoàn thành)
- Triển khai module Đánh giá năng lực: tính điểm gợi ý tự động (50% đúng hạn, 50% hoàn thành) và chấm tiêu chí chất lượng (Manager).
- Xây dựng trang Báo cáo & Phân tích tổng thể với Recharts biểu diễn Donut, Line, Bar charts và xuất kết quả ra file CSV UTF-8 BOM.
- Tích hợp Trợ lý AI (AI Assistant) hỗ trợ viết mô tả, sinh checklists và subtasks tự động dựa trên Gemini API.

### 5.5 Giai đoạn 5: Tối ưu hóa & Đóng gói (Hiện tại & Tiếp theo)
- Tối ưu hiệu năng tải trang bằng phân trang cuộn vô hạn (Infinite Scroll - Intersection Observer) ở các bảng danh sách lớn.
- Khớp tài liệu đặc tả chức năng chi tiết và kiến trúc dữ liệu thực tế hệ thống.
- Đóng gói ứng dụng, cấu hình container Docker để chuẩn bị triển khai lên môi trường Staging/Production.

---

## 6. KẾ HOẠCH TRIỂN KHAI PRODUCTION (PRODUCTION DEPLOYMENT PLAN)

Khi di chuyển từ môi trường phát triển (Local/Dev) sang môi trường vận hành (Production), các dịch vụ lưu trữ tệp, truyền tin real-time và cấu hình API cần được chuyển đổi sang các dịch vụ đám mây chuyên dụng để đảm bảo hiệu năng, tính sẵn sàng và tính bảo mật cao.

### 6.1 Quản lý Lưu trữ và Tệp đính kèm (File Storage/Uploads)
- **Hiện trạng ở Local**: Đang cấu hình `FILESYSTEM_DISK=public` (Lưu trực tiếp tệp đính kèm, ảnh avatar dự án và nhân viên vào thư mục local `/storage/app/public` của server). Cách này không phù hợp khi chạy đa server (Multi-server) hoặc khi container Docker bị khởi động lại (gây mất tệp).
- **Giải pháp chuyển đổi cho Production**:
  * **Công nghệ thay thế**: **Amazon S3** hoặc các dịch vụ S3-Compatible (như **Cloudinary**, **MinIO**, **Google Cloud Storage**).
  * **Cấu hình Laravel**: Thay đổi `FILESYSTEM_DISK=s3` trong `.env` và điền đầy đủ cấu hình AWS:
    ```env
    FILESYSTEM_DISK=s3
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    AWS_DEFAULT_REGION=ap-southeast-1
    AWS_BUCKET=taskflow-production-bucket
    AWS_URL=https://taskflow-production-bucket.s3.amazonaws.com
    ```

### 6.2 Hệ thống Phát tin thời gian thực (Websockets/Broadcasting)
- **Hiện trạng ở Local**: Cấu hình `BROADCAST_CONNECTION=reverb` chạy dịch vụ Laravel Reverb qua giao thức HTTP không bảo mật (`REVERB_SCHEME=http`) ở cổng `8080` trên localhost.
- **Giải pháp chuyển đổi cho Production**:
  * **Phương án 1 (SaaS - Khuyên dùng)**: Sử dụng **Pusher Channels** (dịch vụ đám mây của Pusher). Thay thế `BROADCAST_CONNECTION=pusher` và cấu hình:
    ```env
    BROADCAST_CONNECTION=pusher
    PUSHER_APP_ID=your_pusher_app_id
    PUSHER_APP_KEY=your_pusher_app_key
    PUSHER_APP_SECRET=your_pusher_app_secret
    PUSHER_APP_CLUSTER=ap1
    ```
  * **Phương án 2 (Self-hosted Reverb)**: Tiếp tục chạy Laravel Reverb nhưng phải đặt sau **Reverse Proxy (Nginx)** được cấu hình SSL/HTTPS (WSS). Sử dụng **Redis** làm kênh truyền trung gian để điều phối các worker Reverb.
  * **Cấu hình Frontend**: Đổi cổng kết nối `Pusher`/`Echo` sang giao thức bảo mật `https` / `wss` và đổi Host sang domain production.

### 6.3 Cơ sở dữ liệu & Phân tải (Database Cluster)
- **Hiện trạng ở Local**: Chạy cơ sở dữ liệu MySQL 8.0 trên localhost không có dự phòng và tối ưu.
- **Giải pháp chuyển đổi cho Production**:
  * **Công nghệ thay thế**: Sử dụng các dịch vụ cơ sở dữ liệu quản lý (Managed Database) như **Amazon RDS (MySQL)** hoặc **Google Cloud SQL**.
  * **Cấu hình tối ưu**:
    * Cấu hình Read/Write Connection splitting trong Laravel (chia tải ghi sang Master DB, tải đọc sang các Slave Read Replicas).
    * Thiết lập tự động Backup hàng ngày.

### 6.4 Cache & Hàng đợi xử lý (Cache & Queue Processing)
- **Hiện trạng ở Local**: Đang chạy Driver hàng đợi đồng bộ (`QUEUE_CONNECTION=sync`) - tức là các luồng gửi thông báo, gửi email, gọi AI được xử lý trực tiếp trên request làm chậm thời gian phản hồi.
- **Giải pháp chuyển đổi cho Production**:
  * **Công nghệ thay thế**: Sử dụng **Redis** làm lưu trữ Cache, Sessions và hàng đợi (Queue).
  * **Xử lý Queue**: Cấu hình `QUEUE_CONNECTION=redis` và chạy các worker Laravel nền để xử lý các Job bất đồng bộ.
  * **Quản trị**: Sử dụng **Laravel Horizon** để giám sát trực quan các hàng đợi Queue, các tiến trình lỗi và hiệu năng xử lý Job.

### 6.5 Đăng ký ứng dụng Bitrix24 Production (OAuth2 SSO Setup)
- **Hiện trạng ở Local**: Sử dụng tài khoản Developer App kết nối trực tiếp IFrame về Localhost hoặc ngrok.
- **Giải pháp chuyển đổi cho Production**:
  * Đăng ký ứng dụng chính thức trên Portal Bitrix24 Production của doanh nghiệp.
  * Cấu hình lại **Callback URL** trỏ chính xác về Domain Production HTTPS (ví dụ: `https://taskflow.company.com/api/callback`).
  * Cập nhật `BITRIX_CLIENT_ID` và `BITRIX_CLIENT_SECRET` của ứng dụng chính thức vào cấu hình `.env` của Production.

### 6.6 Bảo mật & Cấu hình CORS
- **Cấu hình bắt buộc cho Production**:
  ```env
  APP_ENV=production
  APP_DEBUG=false
  APP_URL=https://taskflow-api.company.com
  FRONTEND_URL=https://taskflow.company.com
  ```
  * **SSL/HTTPS**: Bắt buộc cài đặt chứng chỉ SSL (Let's Encrypt hoặc AWS Certificate Manager) cho cả Frontend và Backend để đảm bảo an toàn dữ liệu và đáp ứng yêu cầu HTTPS của IFrame Bitrix24.
  * **CORS**: Thiết lập cấu hình CORS trong `config/cors.php` chỉ cho phép duy nhất domain `FRONTEND_URL` truy cập API.

---

*Cập nhật lần cuối: 2026-05-29 (Dựa trên hệ thống thực tế)*
