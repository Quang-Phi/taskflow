# TÀI LIỆU TRAINING AI: TOÀN BỘ KIẾN TRÚC & QUY TRÌNH DỰ ÁN TASKFLOW

Tài liệu này được biên soạn để cung cấp cho bất kỳ AI Agent nào một cái nhìn toàn diện, chi tiết từ cơ sở dữ liệu, các hàm xử lý logic nghiệp vụ ở Backend (Laravel), giao diện Frontend (ReactJS + Ant Design), cho đến các luồng nghiệp vụ chạy thực tế của hệ thống **TaskFlow**.

Hệ thống TaskFlow là một ứng dụng quản lý công việc và hiệu suất dự án nâng cao, lấy cảm hứng từ ClickUp/Jira, đồng bộ nhân sự từ Bitrix24 và tích hợp chấm công (Timesheet), đánh giá hiệu suất nhân viên (Evaluations) cùng với trợ lý ảo AI.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ CHỦ CHỐT
*   **Backend**: Laravel Framework, sử dụng Laravel Sanctum để xác thực API, Laravel Echo để phát thông báo/đồng bộ sự kiện thời gian thực (Real-time).
*   **Frontend**: ReactJS, TypeScript, Ant Design làm UI framework, Recharts vẽ biểu đồ, SCSS quản lý phong cách thiết kế cao cấp (Premium Dark Mode chủ đạo).
*   **Đồng bộ Bitrix24**: Hệ thống đồng bộ dữ liệu User, phòng ban (Departments), chức danh trực tiếp qua Bitrix REST API.

---

## 2. CHI TIẾT CƠ SỞ DỮ LIỆU & CÁC RELATIONSHIPS (BACKEND MODELS)

Dưới đây là cấu trúc của 7 Model cốt lõi trong hệ thống:

```mermaid
classDiagram
    class User {
        +id: int
        +name: string
        +email: string
        +role: string (admin|manager|employee)
        +department_ids: array
        +notification_settings: array
        +theme: string
    }
    class Project {
        +id: int
        +name: string
        +statuses: array
        +created_by: int
    }
    class Task {
        +id: int
        +project_id: int
        +assignee_id: int
        +status: string
        +priority: string
        +watcher_ids: array
        +estimated_hours: float
        +actual_hours: float
    }
    class TimeEntry {
        +id: int
        +task_id: int
        +user_id: int
        +duration: int
        +started_at: datetime
        +ended_at: datetime
    }
    class Evaluation {
        +id: int
        +period: string
        +employee_id: int
        +total_score: float
        +on_time_rate: float
        +score_quality: float
    }
    class Notification {
        +id: int
        +user_id: int
        +type: string
        +read: boolean
    }
    
    User "1" --> "0..*" Project : "members/projects via pivot"
    Project "1" --> "0..*" Task : "has"
    Task "1" --> "0..*" TimeEntry : "has"
    Task "1" --> "0..*" User : "watcher_ids"
    User "1" --> "0..*" TimeEntry : "logs"
    User "1" --> "0..*" Evaluation : "receives"
    User "1" --> "0..*" Notification : "receives"
```

### 2.1. Model `User` (`app/Models/User.php`)
*   **Các trường chính**: `id`, `name`, `first_name`, `last_name`, `email`, `phone`, `photo`, `role` (`admin`, `manager`, `employee`), `active` (boolean), `department_ids` (array), `work_position`, `theme` (`light`, `dark`), `timezone`, `language`, `workspace_name`, `notification_settings` (array).
*   **Quan hệ**:
    *   `projects()`: BelongsToMany `Project` qua bảng trung gian `project_members`, lưu thêm cột pivot `role` (`manager` hoặc `member`).

### 2.2. Model `Project` (`app/Models/Project.php`)
*   **Các trường chính**: `name`, `description`, `color`, `priority` (`low`, `medium`, `high`), `status` (`planning`, `active`, `completed`, `on_hold`), `statuses` (mảng các trạng thái công việc tùy chỉnh), `start_date`, `end_date`, `created_by`.
*   **Quy chế mặc định của `statuses`**: Nếu trống, sẽ tự động gán mảng:
    1.  `todo` (TO DO, màu xám `#9ca0b0`, type: `not_started`, position: 0)
    2.  `in_progress` (IN PROGRESS, màu xanh `#3b82f6`, type: `active`, position: 1)
    3.  `review` (REVIEW, màu tím `#a855f7`, type: `active`, position: 2)
    4.  `done` (COMPLETE, màu lá `#22c55e`, type: `closed`, position: 3)
*   **Quan hệ**:
    *   `createdBy()`: BelongsTo `User`
    *   `members()`: BelongsToMany `User` qua `project_members`
    *   `tasks()`: HasMany `Task`
    *   `labels()`: HasMany `Label`
    *   `customFields()`: HasMany `CustomField`

### 2.3. Model `Task` (`app/Models/Task.php`)
*   **Các trường chính**: `project_id`, `title`, `description`, `status` (khớp với mã ID của trạng thái trong `Project->statuses`), `priority` (`urgent`, `high`, `medium`, `low`), `assignee_id`, `creator_id`, `estimated_hours`, `actual_hours`, `start_date`, `due_date`, `completed_at`, `parent_task_id`, `watcher_ids` (mảng lưu ID các thành viên theo dõi).
*   **Quan hệ**:
    *   `project()`, `assignee()`, `creator()`: BelongsTo.
    *   `subtasks()`: HasMany `Task` với khóa ngoại `parent_task_id`.
    *   `checklists()`: HasMany `Checklist` (được sắp xếp theo cột `position`).
    *   `timeEntries()`: HasMany `TimeEntry` ghi nhận thời gian làm việc.

### 2.4. Model `TimeEntry` (`app/Models/TimeEntry.php`)
*   **Các trường chính**: `task_id`, `user_id`, `started_at`, `ended_at`, `duration` (tính bằng giây), `description`.
*   **Đặc điểm**: Dùng để ghi nhận thời gian chạy bộ đếm giờ (Timer) hoặc khai báo thủ công giờ làm việc của nhân sự.

### 2.5. Model `Evaluation` (`app/Models/Evaluation.php`)
*   **Các trường chính**: `period` (dạng `YYYY-MM`), `employee_id`, `evaluator_id`, `total_tasks`, `completed_tasks`, `on_time_tasks`, `on_time_rate` (tỷ lệ hoàn thành đúng hạn), `score_quality`, `score_responsibility`, `score_communication`, `score_creativity`, `score_discipline`, `total_score`, `comment`, `status` (`draft` hoặc `published`).
*   **Hàm tính điểm nghiệp vụ `calculateTotalScore()`**:
    Điểm hiệu suất tổng kết (`total_score`) được tính theo trọng số:
    *   **40%**: Từ tỷ lệ công việc hoàn thành đúng hạn (`on_time_rate` quy ra thang điểm 10).
    *   **30%**: Từ tỷ lệ hoàn thành công việc (`completed_tasks / total_tasks * 10`).
    *   **30%**: Từ điểm đánh giá thủ công của quản lý (trung bình cộng 5 tiêu chí: quality, responsibility, communication, creativity, discipline).
    *   *Công thức thực tế*:
        $$\text{total\_score} = \text{round}\left( (\frac{\text{on\_time\_rate}}{100} \times 10 \times 0.4) + (\frac{\text{completed\_tasks}}{\text{total\_tasks}} \times 10 \times 0.3) + (\frac{\text{Manual\_Average}} \times 0.3), 1 \right)$$

### 2.6. Model `Notification` (`app/Models/Notification.php`)
*   **Các trường chính**: `user_id`, `actor_id`, `type`, `action`, `target`, `extra`, `task_id`, `project_id`, `read` (boolean).
*   **Luồng xử lý**: 
    Hàm tĩnh `Notification::notify(...)` sẽ kiểm tra cấu hình tắt/bật thông báo của người nhận (`User->notification_settings`). Các loại notification:
    *   `task_assigned` -> map với setting `taskAssigned`
    *   `comment`, `mention`, `reply`, `reaction` -> map với setting `taskComment`
    *   `status_changed` -> map với setting `projectUpdate`
    *   `deadline` -> map với setting `deadline`
    *   `evaluation` -> map với setting `evaluation`
    Nếu người dùng cho phép, Laravel sẽ ghi dữ liệu vào bảng `notifications` và phát ra Event `NotificationReceived` qua Laravel Echo để hiển thị Popup tức thời ở client.

---

## 3. CHI TIẾT CÁC MÀN HÌNH & TÍNH NĂNG Ở FRONTEND (REACT COMPONENTS)

Hệ thống được tổ chức thành 10 module chính trong thư mục `src/pages`:

### 3.1. Dashboard (`DashboardPage.tsx`)
*   **Tính năng**: Màn hình trang chủ của hệ thống.
*   **Dữ liệu hiển thị**:
    *   4 Thẻ chỉ số: Tổng dự án, Công việc đang chạy, Công việc quá hạn, Công việc hoàn thành.
    *   Danh sách nhiệm vụ được giao (`my_tasks`) kèm trạng thái và ngày hết hạn.
    *   Hoạt động gần đây của toàn bộ thành viên dự án (`activities`).
    *   Tiến độ hoàn thành dự án (`project_progress`) hiển thị dưới dạng thanh tiến trình (progress bar).
    *   Hạn chót sắp tới (`upcoming_deadlines`) phân loại hôm nay, ngày mai hoặc sắp tới.

### 3.2. Dự án (`ProjectsPage.tsx`)
*   **Tính năng**: Quản lý danh sách dự án trong Workspace.
*   **Chi tiết giao diện**:
    *   Xem theo dạng Lưới (Grid) hoặc Danh sách (List).
    *   Tìm kiếm và lọc theo trạng thái dự án (`active`, `on_hold`, `completed`).
    *   Phân trang dạng Infinite Scroll (cuộn chuột tự động tải thêm dự án).
    *   Nút Thêm dự án / Chỉnh sửa dự án mở Modal điền các thông tin: Tên, Mô tả, Màu sắc nhận diện, Ngày bắt đầu, Ngày kết thúc.
    *   **Phân quyền**: Chỉ Admin/Manager mới có quyền chỉnh sửa dự án; Chỉ Owner/Admin mới được xóa dự án.

### 3.3. Chi tiết dự án (`ProjectDetailPage.tsx`)
*   **Tính năng**: Đây là màn hình phức tạp nhất, chứa toàn bộ thao tác cốt lõi của một dự án.
*   **Các Tab giao diện**:
    1.  **Tab Kanban Board & List**: Hiển thị danh sách task chia cột theo bộ trạng thái tùy chỉnh của dự án. Người dùng có thể kéo thả task để cập nhật nhanh trạng thái.
    2.  **Tab Lịch (Calendar)**: Trực quan hóa công việc theo ngày/tháng.
    3.  **Tab Thống kê (Dashboard)**: Biểu đồ Recharts phân tích trạng thái công việc.
    4.  **Tab Timesheet**: Báo cáo chấm công các thành viên tham gia dự án.
*   **Quản lý bộ Trạng thái tùy chỉnh (Custom Statuses)**:
    *   Mở Modal thiết kế trạng thái cho dự án. Có thể phân loại vào 3 nhóm (`not_started`, `active`, `closed`).
    *   Hỗ trợ chọn màu sắc, kéo thả thay đổi vị trí (`position`).
    *   *Nghiệp vụ đặc biệt*: Khi người dùng xóa một trạng thái đang có task hoạt động, hệ thống sẽ yêu cầu thực hiện ánh xạ (Mapping) task từ trạng thái cũ sang trạng thái mới trước khi lưu.
*   **Hộp bình luận & Hoạt động thời gian thực**:
    *   Hỗ trợ soạn bình luận, đính kèm file/hình ảnh.
    *   Gõ ký tự `@` để mở Popup gợi ý nhắc tên (`mention`) các thành viên trong dự án.
    *   Trả lời bình luận theo luồng (Threaded reply).
    *   Thả biểu tượng cảm xúc (Reactions: 👍, ❤️, 😆, 😮, 😢, 😡) cho bình luận.

### 3.4. Công việc của tôi (`MyTasksPage.tsx`)
*   **Tính năng**: Tổng hợp toàn bộ công việc cá nhân của user đang đăng nhập.
*   **Giao diện**:
    *   Hỗ trợ hiển thị dạng Kanban, Danh sách, hoặc Lịch.
    *   Lọc nhanh các công việc ưu tiên, công việc hôm nay, công việc quá hạn.
*   **Time Tracker tích hợp**:
    *   Hiển thị nút bấm Play/Stop. Khi nhấn Play, một Timer thời gian thực sẽ chạy. Khi nhấn Stop, hệ thống tự động ghi nhận một bản ghi `TimeEntry` vào cơ sở dữ liệu.
    *   Tích hợp Drawer chi tiết công việc (`TaskDetailPanel.tsx`) giúp xem/sửa nhanh tiêu đề, checklist, độ ưu tiên, đính kèm file, trò chuyện với trợ lý AI.

### 3.5. Bảng thông báo (`InboxPage.tsx`)
*   **Tính năng**: Trung tâm thông báo của người dùng.
*   **Chi tiết**:
    *   Các tab bộ lọc: Tất cả, Chưa đọc, Lời nhắc tên (@mentions), Nhiệm vụ được giao.
    *   Tự động cập nhật thông báo mới tức thời không cần tải lại trang.
    *   Nhấp vào thông báo sẽ dẫn hướng (redirect) người dùng đến thẳng task hoặc dự án liên quan.

### 3.6. Chấm công hàng tuần (`TimesheetPage.tsx`)
*   **Tính năng**: Quản lý chấm công, ghi nhận giờ làm việc theo tuần.
*   **Chế độ xem**:
    *   **Grid view (Chế độ lưới)**: Hiển thị bảng ma trận. Cột là 7 ngày trong tuần (chủ nhật đến thứ bảy), dòng là danh sách các Task. Ô giao nhau hiển thị tổng thời lượng đã log. Cho phép click vào ô để xem danh sách log chi tiết, xóa log hoặc nhập thêm giờ làm việc thủ công (giờ + phút + mô tả).
    *   **List view (Chế độ danh sách)**: Danh sách chi tiết các bản ghi log thời gian.
    *   **Admin/Manager view**: Cho phép xem bảng chấm công của bất kỳ thành viên nào, tìm kiếm thành viên theo phòng ban và theo dõi hiệu suất chấm công tổng quan.

### 3.7. Thành viên phòng ban (`MembersPage.tsx`)
*   **Tính năng**: Quản lý cơ cấu nhân sự. Dữ liệu đồng bộ trực tiếp từ Bitrix24.
*   **Chi tiết**:
    *   Tìm kiếm thành viên, lọc theo phòng ban (Department) hoặc vai trò (Role).
    *   Click vào thành viên mở Drawer hiển thị thông tin chi tiết: Email, Số điện thoại, Tỷ lệ hoàn thành công việc, danh sách các task đang phụ trách, lịch sử các đợt đánh giá hiệu suất định kỳ.
    *   *Quyền Super Admin*: Tài khoản có ID `632` (Super Admin) có đặc quyền mở Modal gán vai trò (`admin` hoặc `employee`) cho các tài khoản khác.

### 3.8. Phân tích báo cáo (`AnalyticsPage.tsx`)
*   **Tính năng**: Trang trực quan hóa toàn bộ dữ liệu hiệu suất của dự án/workspace.
*   **Các biểu đồ**:
    *   *Pie Chart*: Tỷ lệ phân bổ trạng thái công việc (To do, In progress, Done, Overdue).
    *   *Bar Chart*: Số lượng công việc theo độ ưu tiên (Urgent, High, Medium, Low).
    *   *Line Chart*: Biểu đồ xu hướng hoàn thành công việc so với số lượng công việc được tạo mới theo tuần.
    *   *Horizontal Bar*: Biểu đồ phân bổ khối lượng công việc (Workload) của các thành viên.
    *   *Bảng hiệu suất thành viên (Performance Table)*: Thống kê số task được giao, số task hoàn thành, tỷ lệ đúng hạn và thời gian xử lý trung bình của từng người.

### 3.9. Đánh giá hiệu suất (`EvaluationsPage.tsx`)
*   **Tính năng**: Đánh giá hiệu suất nhân viên định kỳ theo tháng/quý.
*   **Các bước xử lý**:
    *   Quản lý chọn Kỳ đánh giá (`period` ví dụ `2026-05`) rồi nhấn "Tạo kỳ đánh giá" (`generateEvaluations`). Hệ thống Backend sẽ quét toàn bộ task của từng nhân sự trong kỳ đó, tính ra các số liệu: Tổng số task phụ trách, Số task hoàn thành, Số task hoàn thành đúng hạn, Tỷ lệ hoàn thành đúng hạn (`on_time_rate`).
    *   Giao diện hiển thị danh sách nhân viên kèm điểm số gợi ý tính toán từ hệ thống.
    *   Nhấp vào nhân viên mở Drawer chi tiết: Hiển thị bảng danh sách các task cụ thể và ngày hoàn thành thực tế để đối chiếu.
    *   Quản lý chấm điểm thủ công 5 tiêu chí (thang điểm từ 0 đến 10), viết nhận xét đánh giá.
    *   Nhấn **Lưu bản nháp (Save Draft)** hoặc **Công bố (Publish)** để nhân viên có thể xem được kết quả điểm số của mình.

### 3.10. Cài đặt hệ thống (`SettingsPage.tsx`)
*   **Tính năng**: Tùy chỉnh cá nhân hóa của tài khoản.
*   **Chi tiết**:
    *   Tab Thông báo: Bật/Tắt các nhóm thông báo (Giao việc mới, Bình luận/Tương tác, Cập nhật trạng thái dự án, Hạn chót công việc, Kết quả đánh giá hiệu suất).
    *   Tab Giao diện & Ngôn ngữ: Đổi theme Sáng/Tối, Đổi ngôn ngữ hiển thị (Tiếng Việt / Tiếng Anh), Cấu hình múi giờ (Timezone).
    *   Tab Hồ sơ Workspace: Đổi tên Workspace làm việc.

---

## 4. CHI TIẾT CÁC QUY TRÌNH NGHIỆP VỤ CỐT LÕI (END-TO-END WORKFLOWS)

### Luồng 1: Thiết lập dự án và phân quyền thành viên
```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend (React)
    participant BE as Backend (Laravel)
    Admin->>FE: Nhập tên dự án, mô tả, màu sắc, thời gian
    FE->>BE: POST /api/projects
    BE-->>FE: Trả về thông tin Project vừa tạo (kèm bộ status mặc định)
    Admin->>FE: Thêm thành viên vào dự án
    FE->>BE: POST /api/projects/{id}/members (truyền user_ids, role)
    BE-->>FE: Cập nhật danh sách thành viên dự án thành công
    Admin->>FE: Chỉnh sửa bộ status tùy chỉnh (Kanban columns)
    FE->>BE: PUT /api/projects/{id}/statuses
    BE-->>FE: Cập nhật cấu hình cột trạng thái
```

### Luồng 2: Tạo công việc, theo dõi tiến độ và Time Tracking
1.  **Tạo công việc**: Thành viên dự án nhấn thêm công việc, nhập: Tiêu đề, Mô tả, Trạng thái (ví dụ: `todo`), Độ ưu tiên (`medium`), Người phụ trách (`assignee_id`), Ngày bắt đầu và Ngày hết hạn. Gọi API `POST /api/tasks`.
2.  **Đồng bộ thông báo**: Hệ thống Backend tự động kiểm tra nếu `assignee_id` khác người tạo, đồng thời người nhận bật cài đặt `taskAssigned` thì sẽ ghi thông báo vào DB và phát sự kiện Broadcast qua Laravel Echo. Người nhận sẽ thấy thông báo nổi lên góc màn hình.
3.  **Thực hiện công việc & Chạy bộ đếm giờ (Time Tracking)**:
    *   Nhân viên mở Drawer chi tiết Task hoặc vào trang Timesheet nhấn nút **Play**.
    *   Gọi API `POST /api/tasks/{id}/timer/start`. Hệ thống lưu thời gian bắt đầu chạy.
    *   Khi hoàn thành hoặc tạm nghỉ, nhân viên nhấn **Stop**. Gọi API `POST /api/tasks/{id}/timer/stop`.
    *   Hệ thống tính toán hiệu số thời gian (`ended_at - started_at`), tạo một bản ghi trong bảng `time_entries` với cột `duration` (giây) và tự động cộng dồn vào trường `actual_hours` của Task đó.
4.  **Hoàn thành công việc**: Nhân viên kéo task sang cột cuối cùng (ví dụ: `done` / `closed`) hoặc tích chọn nút hoàn thành. Hệ thống sẽ tự động gán trường `completed_at = now()`.

### Luồng 3: Đánh giá hiệu suất định kỳ (Evaluation)
1.  **Khởi tạo kỳ đánh giá**: Vào cuối tháng, Manager truy cập trang **Evaluations**, chọn kỳ đánh giá (ví dụ: `2026-05`) và nhấn **Tạo kỳ đánh giá**.
2.  **Tính điểm tự động (KPI)**:
    *   Hệ thống gọi API `POST /api/evaluations/generate`.
    *   Hệ thống Backend quét toàn bộ task của nhân viên được giao trong tháng 05/2026.
    *   Tính tỷ lệ hoàn thành đúng hạn (`on_time_rate`): So sánh ngày hoàn thành `completed_at` với ngày hạn chót `due_date`. Nếu `completed_at` nhỏ hơn hoặc bằng `due_date`, task đó được tính là **Đúng hạn (on_time)**.
    *   Tính điểm số hiệu suất gợi ý bằng cách áp dụng công thức trọng số (40% đúng hạn + 30% tỷ lệ hoàn thành + 30% đánh giá thủ công - mặc định ban đầu điểm thủ công bằng 0).
3.  **Chỉnh sửa & Công bố**:
    *   Manager xem chi tiết từng nhân viên, kéo thanh điểm hoặc nhập điểm cho 5 tiêu chí: chất lượng, trách nhiệm, phối hợp, sáng tạo, kỷ luật. Nhập lời nhận xét cụ thể.
    *   Hệ thống tự động tính toán lại điểm số tổng (`total_score`) theo thời gian thực mỗi khi có thay đổi điểm số tiêu chí.
    *   Manager nhấn **Publish**. Trạng thái chuyển từ `draft` sang `published`. Nhân viên nhận được thông báo kết quả đánh giá của mình.

### Luồng 4: Trợ lý AI tích hợp (AI Assistant)
*   **Sinh Checklist tự động**: Trong màn hình chi tiết công việc, người dùng có thể yêu cầu AI tự động phân rã công việc thành các checklist con bằng cách gửi prompt mô tả công việc. Frontend gọi API `POST /api/tasks/{id}/ai/checklist`. AI phân tích tiêu đề và mô tả công việc, sau đó trả về danh sách các checklist con và tự động thêm vào task.
*   **Chat hỗ trợ công việc**: Người dùng có thể chat trực tiếp với AI trong ngữ cảnh của task đó hoặc chat ở khung chat chung. Gọi API `POST /api/tasks/{id}/ai/chat` hoặc `POST /api/ai/global/chat`. AI có toàn bộ thông tin về dự án, trạng thái task, người phụ trách để trả lời chính xác câu hỏi của người dùng.

---

## 5. HƯỚNG DẪN DÀNH CHO AI KHI THỰC THI NHIỆM VỤ TRÊN CODEBASE NÀY

Khi bạn nhận được yêu cầu sửa lỗi hoặc phát triển tính năng mới cho dự án TaskFlow, hãy luôn tuân thủ các nguyên tắc sau:

### 5.1. Phân quyền và Xác thực (Access Control)
*   Hệ thống chia làm 3 vai trò: `admin`, `manager`, `employee`.
*   Luôn kiểm tra quyền truy cập ở cả FE và BE. Ví dụ: Chỉ quản lý dự án (`pivot->role === 'manager'`) hoặc hệ thống `admin` mới được thêm thành viên, đổi tên dự án hoặc thiết kế cột trạng thái (`statuses`).
*   Khi sửa các API liên quan đến dự án, hãy đảm bảo chỉ thành viên dự án mới được quyền xem hoặc thay đổi dữ liệu của dự án đó.

### 5.2. Đồng bộ trạng thái Task & Dự án
*   Khi thay đổi trạng thái của một Task, giá trị trường `status` của Task đó **phải trùng** với một trong các `id` nằm trong cột `statuses` của bảng `projects`.
*   Không được gán cứng các trạng thái `todo`, `in_progress`, `done` ở backend mà phải luôn lấy từ cột `statuses` của dự án mà task đó thuộc về, vì mỗi dự án có bộ trạng thái và màu sắc hoàn toàn khác nhau.

### 5.3. Định dạng thời gian & múi giờ
*   Thời gian chạy Timer và TimeEntry được lưu dưới dạng UTC ở cơ sở dữ liệu (`started_at`, `ended_at`).
*   Khi hiển thị ra màn hình Frontend, hãy sử dụng cấu hình timezone và ngôn ngữ trong `User->timezone` và `User->language` để format ngày giờ cho chính xác (ví dụ: định dạng hiển thị Việt Nam: `HH:mm DD-MM-YYYY`).

### 5.4. Quy tắc viết code & Thiết kế UI (CSS/SCSS)
*   Dự án đang dùng phong cách thiết kế hiện đại, cao cấp với gam màu tối (Dark mode) làm chủ đạo. Sử dụng các biến CSS CSS Variables có sẵn trong hệ thống (như `var(--bg-card)`, `var(--text-primary)`, `var(--primary)`, `var(--border-color)`) để đảm bảo tính nhất quán của giao diện khi chuyển đổi theme.
*   Khi phát triển component mới ở Frontend, hãy kế thừa phong cách thiết kế Ant Design hiện có và viết CSS tùy biến bằng SCSS để đảm bảo giao diện đẹp mắt và có hiệu ứng hover mượt mà.
