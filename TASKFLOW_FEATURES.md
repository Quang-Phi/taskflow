# TASKFLOW – MÔ TẢ CHI TIẾT CHỨC NĂNG

> Tài liệu này được tạo bằng cách quét toàn bộ codebase thực tế (Frontend & Backend).  
> Cập nhật lần cuối: **2026-06-08**

---

## LAYOUT & ĐIỀU HƯỚNG CHUNG

### Header (Thanh tiêu đề trên cùng)

Thanh header hiển thị trên toàn bộ các trang sau khi đăng nhập, bao gồm:

- **Breadcrumb trái**: Hiển thị tên mục hiện tại (Dashboard).
- **Thanh tìm kiếm toàn cục (Global Search)**: Click vào thanh tìm kiếm hoặc nhấn `Cmd+K` (Mac) / `Ctrl+K` (Windows) để mở Search Modal (`SearchModal.tsx`). Tìm kiếm tasks, projects, members, comments theo từ khóa và nhảy tới kết quả.
- **Nút "+ Thêm mới"** (Create): Dropdown menu với 2 lựa chọn:
  - **New Task**: Kích hoạt sự kiện `open-create-task-modal` để mở modal tạo task toàn cục từ bất kỳ trang nào.
  - **New Project**: Điều hướng tới `/projects?create=true`.
- **Bộ đếm giờ (Timer Widget)**: Nằm giữa thanh header, hiển thị trạng thái bộ đếm hiện tại:
  - **Không có timer chạy**: Hiển thị nút "Bắt đầu tính giờ" (đồng hồ + text). Click mở Popover chi tiết.
  - **Đang chạy timer**: Hiển thị badge đỏ có chấm nhấp nháy (pulse animation) kèm thời gian đang đếm dạng `HH:MM:SS` và nút ■ Stop. Click mở Popover chi tiết gồm:
    - Thanh tiến độ hôm nay (`X.XXh / 8.0h`).
    - Thông tin task đang chạy timer: tên task, tên project, thời gian đếm.
    - Nút Stop timer.
    - Danh sách các time log hôm nay (tên task, project, thời lượng), có thể tái khởi động từng log hoặc xóa.
    - Nút điều hướng nhanh: Dashboard / My Tasks.
  - Timer đồng bộ qua WebSocket (`Laravel Echo` / `Reverb`). Sử dụng `taskflow_server_time_offset` (localStorage) để bù lệch thời gian client-server.
- **Nút thông báo** (chuông 🔔): Hiển thị badge số unread notifications. Click → điều hướng tới trang `/inbox`.
- **Avatar người dùng**: Dropdown menu:
  - **Hồ sơ của tôi** → Mở Modal hồ sơ (Profile Modal) hiển thị avatar/tên/email/phone/work_position/vai trò (chỉ xem, dữ liệu đồng bộ từ Bitrix24).
  - **Cài đặt hệ thống** → `/settings`.
- **Nhận thông báo real-time**: Header lắng nghe kênh WebSocket private `App.Models.User.{user.id}`:
  - Sự kiện `.notification.received`: Tự động tăng badge unread, dispatch `notification-received-global` event và hiển thị **toast thông báo** (Ant Design Notification) ở góc dưới phải với icon màu tương ứng loại thông báo.
  - Sự kiện `.timer.updated`: Refresh timer data ngay lập tức.

---

### Sidebar (Thanh điều hướng trái)

**Có thể thu gọn (icon-only mode)** bằng nút Collapse ở cuối sidebar. Trạng thái được áp dụng cho toàn bộ layout.

| Icon | Mục | Đường dẫn |
|------|-----|-----------|
| 🏠 | Dashboard | `/` |
| 📋 | Projects | `/projects` |
| ✅ | My Tasks | `/my-tasks` |
| 🕐 | Timesheet | `/timesheet` |
| 📥 | Inbox | `/inbox` (kèm badge số unread) |
| 📊 | Analytics | `/analytics` |
| ⭐ | Evaluations | `/evaluations` |
| 👥 | Members | `/members` |
| ⚙️ | Settings | `/settings` |

**Phần "Projects" mở rộng trong sidebar:**
- Có mũi tên `▶` để toggle expand/collapse danh sách project.
- Hiển thị danh sách dự án tải từ API `/api/projects` (lazy load khi cần, refresh khi có sự kiện `projects-changed`).
- Mỗi project: icon màu nhỏ (14×14px) + tên project + badge số task **active** (task chưa done và không phải subtask).
- Click dự án → `/projects/:id`.
- Nút **"+ New Project"** ở cuối danh sách → `/projects?create=true`.
- Badge unread inbox cập nhật realtime qua sự kiện `unread-count-changed`.

---

## 1. DASHBOARD (Trang chủ – `/`)

### 1.1 Lời chào cá nhân hóa (Personalized Greeting)

- Lời chào dựa trên giờ hiện tại trong ngày: **Sáng** ☀️ (5–11h), **Trưa** ☕ (11–13h), **Chiều** ☀️ (13–18h), **Tối** 🌙 (18–5h).
- Nội dung chào được chọn ngẫu nhiên từ mảng 4 câu chào cho mỗi khung giờ, hỗ trợ song ngữ Việt/Anh theo ngôn ngữ hiện tại của user.
- Dòng phụ: `Bạn đang có X công việc cần xử lý.` (số lượng task active của user).

### 1.2 Thẻ chỉ số tổng quan (Stat Cards)

4 thẻ số liệu lớn, mỗi thẻ có thể click để điều hướng và lọc:

- **Tổng dự án**: Tổng số project trong hệ thống. Click → `/projects`.
- **Đang làm**: Số task chưa ở trạng thái closed (type='closed'). Click → `/my-tasks?filter=active`.
- **Trễ hạn**: Task có `due_date < hôm nay` và chưa hoàn thành. Hiển thị badge xu hướng đỏ. Click → `/my-tasks?filter=overdue`.
- **Đã hoàn thành**: Số task đã done/closed. Badge xu hướng xanh lá. Click → `/my-tasks?filter=done`.

### 1.3 Widget Công việc của tôi (My Tasks Widget)

- Hiển thị danh sách task được giao cho user hiện tại.
- Mỗi dòng task hiển thị:
  - **Dải màu trái** theo priority: `urgent` = đỏ, `high` = cam, `medium` = vàng, `low` = xanh dương.
  - **Vòng tròn trạng thái**: Icon ✅ nếu task đã closed. Nếu chưa: vòng tròn vẽ bằng `conic-gradient` tương ứng với % vị trí của status hiện tại trong workflow project (ví dụ: status thứ 2/4 = 50%).
  - **Badge loại**: `TaskTypeBadge` cho Task hoặc Bug.
  - Tên project (chấm màu + tên).
  - Hạn chót (đỏ nếu quá hạn).
  - Avatar assignee.
- Click task → Mở **Task Detail Panel** (drawer trượt phải).
- Nút **"Xem tất cả →"** → `/my-tasks`.

### 1.4 Widget Tiến độ dự án (Project Progress)

- Liệt kê các project đang active kèm thanh progress bar % hoàn thành.
- Màu thanh progress đồng bộ với màu nhận diện project.
- Click project → `/projects/:id`.

### 1.5 Widget Thời hạn sắp tới (Upcoming Deadlines)

- Danh sách task có due_date trong vòng **7 ngày tới**.
- Nhãn thông minh: `Hôm nay` / `Ngày mai` / ngày tháng rút gọn.
- Click task → Mở Task Detail Panel.

### 1.6 Widget Hoạt động gần đây (Recent Activity)

- Timeline các hoạt động mới nhất của toàn team: tạo task, đổi trạng thái, giao lại, bình luận, xóa,...
- Mỗi dòng: avatar + tên người thực hiện + hành động + tên task + chi tiết thay đổi + thời gian tương đối (`vừa xong`, `15 phút trước`, `2 ngày trước`,...).

---

## 2. PROJECTS (Quản lý dự án – `/projects`)

### 2.1 Danh sách dự án (Projects Page)

**Header:**
- Tiêu đề "Dự án" + phụ đề tổng số project.
- Nút **"+ Tạo dự án"** → mở `CreateProjectModal`.

**Toolbar:**
- Ô tìm kiếm theo tên (Debounce 300ms).
- Bộ lọc nhanh: **Tất cả** / **Đang hoạt động** (`active`) / **Tạm dừng** (`on-hold`) / **Đã hoàn thành** (`completed`).
- Chuyển đổi **Lưới (Grid) 🔲 / Danh sách (List) ☰**.

**Grid View:**
- Mỗi thẻ project gồm:
  - Dải màu ngang đầu thẻ.
  - Icon project (tùy chỉnh hoặc chữ cái viết tắt, bo tròn).
  - Tên + `#ID`.
  - Mô tả ngắn (hiện "Không có mô tả" nếu trống).
  - Thanh progress bar % hoàn thành (task `status='done'` / tổng task).
  - Avatar stack thành viên (tối đa 3, kèm `+N` nếu nhiều hơn).
  - Số liệu: `✅ done/total`, hạn chót project.
  - Badge trạng thái màu (active/on-hold/completed).
  - Nút ✏️ chỉnh sửa (chỉ nếu `canEditProject` = admin/creator/manager dự án).

**List View:**
- Bảng cột: Tên + icon, Tiến độ (bar + %), Trạng thái, Thành viên (avatar stack, tối đa 4), Hạn chót, Cột hành động.
- Nút `⋮` mở dropdown: Chỉnh sửa / Xóa (với confirm dialog).

**Phân quyền:**
- `canEditProject`: Admin **hoặc** creator project **hoặc** thành viên có role `manager`.
- `canDeleteProject`: Chỉ Admin **hoặc** creator project.

**Tải thêm (Infinite Scroll):**
- Ngưỡng 150px từ đáy trang → tự động tăng page.
- 12 project/trang, hỗ trợ pagination từ API.

### 2.2 Tạo dự án (Create Project Modal)

Fields:
- **Icon & Màu sắc** (`ProjectIconPicker`): Chọn màu + upload ảnh icon (base64) hoặc chọn emoji/icon từ thư viện.
- **Tên dự án** (bắt buộc, `*`).
- **Mô tả**.
- **Ngày bắt đầu** và **Ngày kết thúc** (validate: end >= start).
- **Thành viên**: Popover tìm kiếm + avatar stack (tối đa hiển thị 10, phần còn lại thu gọn vào badge `+N`). Mỗi avatar có nút `x` xóa nhanh.
- Footer: Nút Hủy + Nút "Tạo dự án".

### 2.3 Chỉnh sửa dự án (Edit Project Modal)

- Chỉnh sửa: icon, màu, tên, mô tả, ngày bắt đầu, ngày kết thúc, trạng thái project.
- Nút **"Xóa dự án"** (chỉ Admin/Creator), kèm `DeleteConfirmModal` xác nhận.

---

## 3. PROJECT DETAIL (Chi tiết dự án – `/projects/:id`)

### 3.1 Header dự án

- Icon + tên + `#ID` dự án.
- Badge trạng thái dự án.
- Nút **"Manage Statuses"** → mở `WorkflowEditor` (`/projects/:id/workflow`).
- Nút **Chỉnh sửa** (✏️) và **Xóa** (🗑️) với phân quyền `canEditProject` / `canDeleteProject`.
- Nút Back ← quay về `/projects`.

### 3.2 Tabs điều hướng

Trang chi tiết dự án có **3 tab chính** (sử dụng Ant Design Tabs hoặc radio buttons):

#### Tab 1: Công việc (Tasks)

**Toolbar lọc & tìm kiếm:**
- Ô tìm kiếm theo tiêu đề task (DebouncedSearchInput, 300ms).
- Nút **Filter** (Popover 4 danh mục, có badge active count):
  - **Assignee**: My Tasks (chỉ task của tôi), Unassigned (chưa giao), chọn từng thành viên project.
  - **Status**: Chọn nhiều trạng thái (hiển thị màu dot tương ứng).
  - **Priority**: Urgent / High / Medium / Low.
  - **Type**: Task / Bug.
  - Footer popover: Nút "Clear filter" + hiển thị số lượng bộ lọc đang active.
- Nút **Group By** (chỉ List View): Dropdown nhóm theo **Status** / **Priority** / **Due Date**.
- Bộ chuyển đổi View: **List** ☰ / **Board** 🔲 / **Calendar** 📅.
- Nút **"+ Add task"** → mở `CreateTaskModal`.

**Chế độ List View:**
- Danh sách task nhóm theo cấu hình chọn (mặc định: Status).
- Mỗi nhóm có thể collapse/expand, kèm nút `+` tạo task inline trong nhóm.
- Mỗi dòng task:
  - **Checkbox trạng thái**: Click chuyển sang status tiếp theo trong workflow (có workflow modal nếu cần thêm thông tin).
  - Badge type (Task/Bug).
  - Mã task (`PROJECT-ID` dạng `ACME-23`, màu theo priority).
  - Tiêu đề (click → mở Task Detail Panel).
  - Labels (chip màu).
  - Avatar assignee.
  - Hạn chót (đỏ nếu quá hạn).
  - Icon cờ priority.
  - Nút `⋮` khi hover: **Ghi nhận thời gian** / **Theo dõi (Watch)** / **Đánh dấu hoàn thành** / **Xóa**.
- Hỗ trợ kéo thả (Drag & Drop) reorder task trong cùng nhóm hoặc chuyển nhóm.

**Chế độ Board View (Kanban):**
- Mỗi cột = một status trong project workflow.
- Nút **"+ Add Task"** ở đầu/cuối cột tạo task nhanh với status đó.
- Hỗ trợ kéo thả card giữa các cột (cập nhật status ngay).
- Mỗi thẻ task: tên, type badge, priority icon, assignee avatar, due date (đỏ nếu quá hạn), label chips.
- Click card → Mở Task Detail Panel.
- **Kéo thả realtime**: Sử dụng `@dnd-kit/core` kết hợp với WebSocket broadcast để đồng bộ vị trí task.

**Chế độ Calendar View:**
- Lưới 6 tuần / 42 ngày (component `TaskCalendar.tsx`).
- Dải băng event task (event bars) trải dài theo date range (start_date → due_date).
- **Thuật toán xếp track song song**: Tự động tính toán position (track row) để các task có date range chồng lấn không bị đè lên nhau.
- Hover ô ngày → nút `+` tạo task nhanh với ngày được chọn.
- Click task bar → Popover xem nhanh (tên, status, assignee, due date).
- Điều hướng: Nút `<` `>` chuyển tháng + chọn tháng/năm từ Dropdown + nút "Hôm nay" về tháng hiện tại.

#### Tab 2: Bảng công (Timesheet – Sub-tab)

*(Tích hợp tương tự trang Timesheet toàn cục nhưng giới hạn trong phạm vi dự án)*

- Bộ lọc: Khoảng thời gian (Hôm nay / Tuần này / Tháng này / Tùy chỉnh), Thành viên.
- Thẻ thống kê: Tổng giờ + số logs, Thành viên active nhất, Task tốn thời gian nhất.
- **Biểu đồ (Recharts)**:
  - Horizontal Bar Chart: Thời gian theo thành viên.
  - Pie Chart: Phân tích top 7 task tốn nhiều giờ nhất.
- Bảng chi tiết log: Thành viên, Task (link mở detail), Ghi chú, Thời gian bắt đầu, Thời lượng (h), Xóa (Admin hoặc chính người ghi).

#### Tab 3: Thành viên (Members – Sub-tab)

- Bảng danh sách thành viên dự án: Avatar, Tên, Email, Vai trò trong project, Số task đang giao, Ngày tham gia.
- Dropdown đổi vai trò: `Manager` ↔ `Member` (chỉ Manager/Admin/Owner có thể thay đổi, đồng bộ ngay xuống DB).
- Nhãn **Owner** cố định cho người tạo project.
- Nút **"+ Thêm thành viên"**: Popover tìm kiếm user trong workspace và mời vào project.
- Nút xóa thành viên (kèm confirm dialog).

### 3.3 Task Detail Panel (Right Drawer – Dùng chung toàn hệ thống)

*Component `TaskDetailPanel.tsx` (274KB), dùng chung cho Dashboard, My Tasks, Project Detail, Inbox.*

**Header Panel:**
- `#ID` task.
- **Watchers**: Số người theo dõi + danh sách avatar. Nút **Watch/Unwatch** (ẩn nếu task đang gán cho chính user).
- Nút **Xóa task** (🗑️, mở `DeleteConfirmModal`, thực hiện Soft Delete).
- Nút đóng `×`.

**Layout 2 cột:**

**Cột trái (Nội dung chính):**
- **Breadcrumb**: `[Project Name] / [Parent Task tên] (nếu là subtask) / [Type Badge + ID]`.
- **TaskTypeBadge**: Click đổi nhanh type (Task ↔ Bug).
- **Tiêu đề task**: Textarea tự động co giãn, auto-save khi blur hoặc Enter.
- **Bảng thuộc tính (Properties Grid)**:
  - **Status** (`ClickUpStatusPicker`): Dropdown search + nhóm statuses (Not Started / Active / Closed). Nút mũi tên → chuyển sang status tiếp theo. Hỗ trợ `allowedStatusIds` khi workflow ở chế độ restricted.
  - **Assignee**: Dropdown chọn thành viên project. Phân quyền: Standard member chỉ có thể assign cho bản thân (trừ subtask).
  - **Priority** (`PriorityPicker`): Flag icon picker (Urgent/High/Medium/Low + Clear).
  - **Estimate**: Tự động tính từ start_date → due_date (giờ).
  - **Thời gian (Date Range)**: DatePicker kép cho `start_date` và `due_date`. **Bị khóa** nếu task đang có time entry đang chạy.
  - **Time Tracking** (`TimeTracker`): 
    - Nút Play ▶ (xanh lá) / Pause ⏸ (đỏ) bắt đầu/dừng timer.
    - Hiển thị thời gian đang chạy (đỏ, nhấp nháy pulse dot) hoặc tổng giờ đã log.
    - Popover **Add Manual Time**: nhập giờ/phút + ghi chú, nút Save.
  - **Custom Fields**: Hiển thị các trường tùy chỉnh của project (`text`, `number`, `date`, `dropdown`, `checkbox`). Click để chỉnh sửa inline, nút xóa giá trị.
  - **Milestone**: Dropdown chọn milestone của project (nếu có).
- **Mô tả (Description)**: Click để soạn thảo (TipTap editor). Nút **"✨ Viết bằng AI"** → Mở AI Input để sinh mô tả tự động.
- **Subtasks**: Danh sách task con, mỗi dòng có checkbox, tiêu đề, assignee, priority. Nút tạo subtask mới. Nút **"AI → Sinh subtask"**.
- **Checklists**: Nhiều nhóm checklist, mỗi item có checkbox + tên + assignee. Convert item thành subtask/task độc lập. Nút **"AI → Sinh checklist"**.
- **Attachments**: Drag & drop hoặc click để upload. Xem trước ảnh inline (jpg, png, gif, webp). Nút Download / Rename / Delete.
- **Dependencies**: Hiển thị danh sách dependencies (blocks / is blocked by / clones / is cloned by / relates to). Nút thêm dependency, nút xóa.

**Cột phải (Activity & Discussion):**
- Tab **Bình luận (Comments)**:
  - Ô nhập comment: Emoji picker, @mention thành viên, đính kèm ảnh/file.
  - Danh sách comment theo thứ tự mới nhất → cũ nhất.
  - Mỗi comment: avatar, tên, nội dung, thời gian, nút Reply, Reactions (thả emoji), Edit/Delete (nếu là tác giả).
  - Hiển thị luồng reply lồng nhau (threaded).
- Tab **Lịch sử hoạt động (Activity)**:
  - Timeline đầy đủ: tạo task, đổi title/status/priority/assignee/dates/description, bắt đầu/dừng timer, comment, upload file,...
  - Mỗi dòng: avatar + tên + hành động + chi tiết thay đổi + thời gian tương đối.

**Auto-save:** Mọi thay đổi (title, status, assignee, priority, dates, description, custom fields) được lưu ngay lập tức qua API call, không cần nút Save thủ công.

---

## 4. WORKFLOW EDITOR (Trình chỉnh sửa quy trình – `/projects/:id/workflow`)

### 4.1 Toolbar

- Nút ← quay về project detail.
- Tiêu đề: "Thiết lập Workflow – [Tên dự án]".
- **Toggle chế độ**:
  - **Unrestricted**: Tất cả status đều có thể chuyển sang nhau tự do (mặc định).
  - **Restricted**: Chỉ cho phép chuyển status theo transitions đã định nghĩa. Nếu vi phạm, backend trả về lỗi và frontend hiển thị `WorkflowTransitionModal` yêu cầu nhập thêm thông tin.
- **⇌ Thêm Transition**: Bật chế độ vẽ mũi tên. Click node nguồn → click node đích để tạo transition.
- **⚡ Tạo nhanh (Preset)** dropdown:
  - **All**: Tạo transition 2 chiều giữa mọi cặp status.
  - **Linear (Chỉ tiến)**: Tuyến tính từ trái sang phải (1 chiều).
  - **Linear Back (Tiến + Lùi)**: Tuyến tính 2 chiều.
  - **Clear**: Xóa toàn bộ transitions.
- Nút **Lưu Workflow** (💾): Lưu statuses, transitions, global_transitions, node positions và initial_status.
- Nút **Hủy bỏ**: Thoát không lưu.

### 4.2 Canvas (Sơ đồ kéo thả)

- Mỗi node = một status: Tên, màu sắc, badge `Initial` (nếu là status ban đầu).
- Kéo thả node tự do để bố trí sơ đồ.
- **Transitions** hiển thị dạng mũi tên cong giữa các node.
- **Global Transitions**: Một số status có thể được chuyển đến từ bất kỳ status nào (ví dụ: "Cancelled").
- Click transition → chọn xóa.

### 4.3 Panel bên phải (Status Management)

- **Danh sách statuses**: Reorder bằng kéo thả (HolderOutlined handle). Mỗi status: màu dot, tên, type (not_started/active/closed), nút đổi tên, nút xóa.
- **Thêm status mới**: Input tên + Color picker + chọn type.
- **Templates**: Dropdown chọn mẫu status sẵn có (từ bảng `status_templates`) để load nhanh.
- **Rules cho Transition**: Click một transition → Cấu hình các hành động tự động khi transition xảy ra:
  - `assign_user`: Gán task cho `current_user` hoặc clear assignee.
  - `update_field`: Cập nhật field (`priority`, `assignee_id`, `start_date`, `labels`,...).

---

## 5. MY TASKS (Task của tôi – `/my-tasks`)

### 5.1 Header & Toolbar

- Tiêu đề "My tasks" + số lượng task đang active.
- Bộ lọc: Search (debounce), Filter Popover (giống Project Detail), nút Group By.
- Group By bổ sung: **Dự án (Project)** và **Hạn chót (Due Date)** (ngoài Status và Priority).
  - Due Date groups: **Quá hạn** / **Hôm nay** / **Tuần này** / **Tuần tới** / **Không có hạn**.
- Bộ chuyển đổi View: **List** / **Board** / **Calendar**.

### 5.2 List View

- Nhóm task theo cấu hình chọn. Mỗi nhóm collapse/expand.
- Mỗi dòng task (tương tự Project Detail List, bổ sung):
  - Tên project (chấm màu + tên).
  - Badge status hiện tại.
- Nút `⋮` hành động: Xem chi tiết / Theo dõi / Bỏ theo dõi / Giao lại / Đánh dấu hoàn thành / Ghi nhận giờ / Xóa.

### 5.3 Board View

- Các cột là các status **tổng hợp từ tất cả project** của user.
- Mỗi task card hiển thị **tên project** bên dưới tiêu đề.
- Hỗ trợ kéo thả.

### 5.4 Calendar View

- Hiển thị **toàn bộ task của user** từ tất cả project.
- Dùng component `TaskCalendar.tsx` (giống Project Calendar).
- Tính năng đầy đủ: navigation, event bars, track algorithm, hover popup, tạo task nhanh.

---

## 6. TẠO TASK MỚI (Create Task)

### Cách 1: Quick Create (Inline)

- Nhấn `+` ở đầu/cuối cột Kanban hoặc tiêu đề nhóm trong List View → Inline form nhỏ xuất hiện ngay tại cột:
  ```
  [Nhập tiêu đề task...] [Assignee] [Due date] [Enter để tạo]
  ```

### Cách 2: Full Create Modal (`CreateTaskModal.tsx`)

Mở từ: nút `+` trên ô ngày Calendar / nút Global Header / event `open-create-task-modal`.

**Header Modal:**
- Dropdown **Chọn dự án** (bắt buộc chọn trước).
- Dấu `/`.
- Dropdown **Loại**: Task (icon tích xanh) / Bug (icon con bọ đỏ).

**Nội dung:**
- **Tên task** (bắt buộc).
- **Mô tả** (textarea).
- **Template**: Dropdown chọn từ danh sách task templates. Tự động điền description, type, priority, checklists, subtasks.

**Properties Grid:**
- **Status**: Dropdown chọn status (mặc định: status đầu tiên của project, hoặc `initial_status` của workflow).
- **Assignee**: Dropdown chọn thành viên project.
- **Priority**: Mặc định `medium`.
- **Dates**: Bắt đầu → Hạn chót (tự động tính `estimated_hours`).
- **Milestone**: Dropdown chọn milestone (nếu project có milestone).
- **Recurring Task** (Task định kỳ): Toggle bật/tắt, chọn tần suất:
  - **Daily** (hàng ngày): Interval (mỗi N ngày), Giờ thực hiện.
  - **Weekly** (hàng tuần): Interval, Các ngày trong tuần (checkbox Mon–Sun), Giờ.
  - **Monthly** (hàng tháng): Interval, Ngày trong tháng (1–31), Giờ.
  - **Yearly** (hàng năm): Interval, Giờ.

**Footer:** Nút Hủy + Nút "Tạo công việc".

**Backend xử lý tạo task:**
- Nếu project có workflow và `initial_status`, backend **bỏ qua** status frontend gửi và dùng `initial_status`.
- Nếu task dùng template: apply checklists và subtasks từ template.
- Nếu task recurring: tính `recurring_next_trigger` ngay.
- Gửi notification `task_assigned` cho assignee.
- Broadcast event `TaskUpdated` qua WebSocket.

### Cách 3: Global Create

- Header → `+` → **New Task** → Dispatch event `open-create-task-modal` → mở Full Create Modal.

---

## 7. QUẢN LÝ TASK - PHÂN QUYỀN

Hệ thống TaskFlow áp dụng cơ chế phân quyền ma trận 2 lớp kết hợp đồng bộ cơ cấu tổ chức từ Bitrix24 để tối ưu bảo mật và tăng hiệu quả quản lý dự án.

### 7.1 Bản đồ Phân quyền Hệ thống (System-Level Roles)

Xác định dựa trên cột `role` trong bảng `users` (`admin`/`superadmin`, `manager`, `employee`), liên kết chặt chẽ với sơ đồ phòng ban từ Bitrix24.

| Hành động / Tính năng | Admin / Super Admin | Bitrix Manager (Trưởng phòng) | Employee (Nhân viên) |
| :--- | :---: | :---: | :---: |
| **Xem danh sách thành viên** | ✅ Toàn quyền hệ thống | ⚠️ Chỉ xem cấp dưới thuộc phòng ban mình quản lý | ❌ Chỉ xem chính mình trên danh mục chung |
| **Tìm kiếm thành viên (Global Search)** | ✅ Tìm kiếm toàn bộ | ⚠️ Chỉ tìm thấy cấp dưới hoặc thành viên chung dự án | ❌ Chỉ tìm thấy chính mình |
| **Tạo dự án mới** | ✅ Được phép | ✅ Được phép | ✅ Được phép |
| **Gán vai trò khi thêm vào dự án** | ✅ Có thể gán bất kỳ ai làm `manager`/`member` | ⚠️ Thành viên thuộc phòng ban mình quản lý $\rightarrow$ `manager`/`member`. Thành viên ngoài phòng ban $\rightarrow$ tự động chuyển thành `collaborator` (Cor) | ❌ Không được phép (chỉ có thể tự thêm mình) |
| **Thiết lập hệ thống & cấu hình AI** | ✅ Được phép | ❌ Không được phép | ❌ Không được phép |

*   **Trưởng phòng (Bitrix Manager)**: Hệ thống tự động xác định Trưởng phòng dựa trên trường `UF_HEAD` từ Bitrix24. Trưởng phòng được quyền quản lý toàn bộ nhân viên thuộc phòng ban đó và các phòng ban con cấp dưới theo cấu trúc cây thư mục.
*   **Cơ chế tự động hạ quyền thành Collaborator**: Nhằm bảo vệ thông tin nội bộ của các phòng ban, khi Trưởng phòng ban này thêm nhân sự thuộc phòng ban khác vào dự án của mình, hệ thống sẽ tự động hạ quyền của nhân sự đó xuống mức **Collaborator (Cộng tác viên - Cor)** để giới hạn quyền truy cập.

---

### 7.2 Bản đồ Phân quyền Dự án (Project-Level Roles)

Thành viên tham gia dự án được gán một trong các vai trò thuộc bảng liên kết `project_members`:

| Hành động | Project Manager (PM) | Project Member | Collaborator (Cộng tác viên - Cor) |
| :--- | :---: | :---: | :---: |
| **Chỉnh sửa thông tin dự án** | ✅ Được phép | ❌ Không được phép | ❌ Không được phép |
| **Xóa dự án** | ✅ Chỉ người tạo dự án (Owner) | ❌ Không được phép | ❌ Không được phép |
| **Quản lý trạng thái (Workflow)** | ✅ Được phép | ❌ Không được phép | ❌ Không được phép |
| **Thêm/Xóa/Sửa vai trò thành viên** | ✅ Được phép | ❌ Không được phép | ❌ Không được phép |
| **Tạo công việc chính (Main Task)** | ✅ Được phép | ✅ Được phép | ✅ Được phép |
| **Gán công việc chính (Assignee)** | ✅ Gán cho bất kỳ ai trong dự án | ⚠️ Chỉ được tự gán cho chính mình | ⚠️ Chỉ được tự gán cho chính mình |
| **Tạo & Gán công việc con (Subtask)** | ✅ Được phép | ✅ Được phép | ✅ Được phép |
| **Xem danh sách & chi tiết công việc** | ✅ Xem toàn bộ | ✅ Xem toàn bộ | ⚠️ Chỉ xem công việc do mình tạo, được giao, đang theo dõi (Watcher) hoặc công việc con (Subtask) thuộc công việc chính mình phụ trách |
| **Chuyển trạng thái công việc** | ✅ Theo workflow dự án | ✅ Theo workflow dự án | ⚠️ Chỉ được chuyển trạng thái của công việc được giao cho mình |
| **Xóa công việc** | ✅ Được phép (Soft Delete) | ❌ Không được phép | ❌ Không được phép |

---

### 7.3 Quyền quản lý Tệp đính kèm (Attachments) và Nhập giờ (Timesheet)

*   **Tệp đính kèm (Attachments)**:
    *   **Thêm mới**: Tất cả thành viên dự án (kể cả Collaborator) đều được phép tải tệp lên công việc.
    *   **Chỉnh sửa tên / Xóa tệp**: Chỉ có **người tải lên (uploader)**, **Project Manager** hoặc **Admin/Super Admin** mới có quyền chỉnh sửa tên hoặc xóa tệp đính kèm khỏi công việc.
*   **Bảng công (Timesheet)**:
    *   **Nhập giờ làm việc (Log time)**: Thành viên được gán công việc hoặc có trong grid mới được log giờ.
    *   **Xóa Log time**: Chỉ có **người tạo log** hoặc **Admin/Super Admin** mới có quyền xóa.
    *   **Xem Timesheet**: Nhân viên thường chỉ xem được bảng công của chính mình. Admin và Manager hệ thống có quyền xem và lọc bảng công của tất cả thành viên.

---

### 7.4 AI Chat & Cơ chế Xác nhận (Dry-run)

Để tránh trường hợp Trợ lý AI thực hiện trực tiếp các hành động thay đổi dữ liệu nhạy cảm mà không có sự kiểm soát của người dùng, hệ thống áp dụng cơ chế **Dry-run**:
*   Khi người dùng trò chuyện với AI toàn cục và yêu cầu thực hiện hành động sửa đổi (như tạo dự án, tạo công việc, cập nhật công việc):
    1. AI sẽ gọi tool tương ứng với tham số `confirmed = false` (hoặc omit).
    2. Backend trả về trạng thái `requires_confirmation = true` kèm thông tin kế hoạch hành động dưới dạng JSON.
    3. Giao diện Frontend nhận thông tin kế hoạch và hiển thị giao diện xác nhận (nút "Đồng ý/Xác nhận") chuyên nghiệp cho người dùng.
    4. Khi người dùng nhấn xác nhận, Frontend mới gửi yêu cầu thực thi chính thức với tham số `confirmed = true` lên Backend để cập nhật cơ sở dữ liệu.

---


---

## 8. TIMESHEET (Bảng công – `/timesheet`)

### 8.1 Header & Tabs

- Tiêu đề "Bảng công" + phụ đề.
- **Tab My Timesheet**: Xem timesheet của bản thân.
- **Tab All Timesheets** (chỉ Admin/Manager): Xem timesheet của tất cả members.

### 8.2 Toolbar

- **Week Selector**: Nút ← Prev / Today / Next → + nhãn dải tuần (`"Sun Jan 5 - Sat Jan 11, 2025"`) hiển thị theo locale/lang.
- **Member Filter** (chỉ Tab "All"): Input tìm kiếm tên member (debounce 450ms), load danh sách user với infinite scroll (30 user/trang, Intersection Observer).
- **View Toggles** (chỉ Tab "My"): **Timesheet Grid** 📊 / **List View** ☰.
- Nút **"+ Ghi nhận thời gian"**: Mở `ManualTimeLogModal` với task được gán đầu tiên (nếu không có task active → toast warning).

### 8.3 Grid View (My Timesheet)

**Bảng tuần (Week Matrix):**
- Cột đầu: Task (tên task + tên project + màu project + TaskTypeBadge).
- 7 cột tiếp theo: Mỗi cột là một ngày trong tuần (Sun → Sat), header hiển thị tên ngày (Mon/Tue,...) + số ngày. Ngày hôm nay được highlight.
- Mỗi ô: Tổng giờ đã log cho task đó trong ngày đó. Click ô → Popover chi tiết.
- Hàng "Total": Tổng giờ mỗi ngày.
- Cột "Total": Tổng giờ của task trong tuần.
- **Grand Total**: Tổng giờ toàn tuần.

**Popover chi tiết ô (Cell Popover):**
- Tên task + ngày.
- Danh sách từng time entry: thời lượng + mô tả + (tên user nếu Tab "All"). Nút 🗑️ xóa (Admin hoặc chính người log).
- Nút **"+ Ghi nhận giờ"** (disabled nếu task đã done hoặc không phải assignee).

**Thêm task vào grid:**
- Nút **"+ Add Task"** (Popover): Tìm kiếm và thêm task chưa có log vào grid để log giờ.
- Danh sách `distinctGridTasks` = task đã có log tuần này + task thêm thủ công.

**Play/Stop timer từ grid:**
- Mỗi dòng task có icon ▶/⏸ để bắt đầu/dừng timer ngay từ grid.
- Khi toggle timer → dispatch `timer-updated` event → Header timer refresh.

### 8.4 List View (My Timesheet)

- Danh sách các time entry trong tuần, hiển thị: Task, Project, Mô tả, Ngày, Thời lượng, Nút xóa.

### 8.5 All Timesheets (Tab Admin/Manager)

**Grid View:**
- Cột đầu: Member (avatar + tên).
- 7 cột ngày.
- Mỗi ô: Tổng giờ của member trong ngày đó.
- Hàng Member: Click → Mở **Member Detail Drawer** (Ant Design Drawer) hiển thị chi tiết log của member đó trong tuần: danh sách task, giờ, ghi chú.

**Member filter**: Tìm kiếm member, infinite scroll (Intersection Observer với sentinel ref).

### 8.6 Manual Time Log Modal (`ManualTimeLogModal.tsx`)

Fields:
- **Task**: Dropdown chọn task (selectableTasks = assigned tasks chưa done + distinctGridTasks).
- **Ngày giờ bắt đầu** (datetime input, mặc định = giờ hiện tại).
- **Thời lượng**: Input giờ + phút.
- **Ghi chú/Mô tả** (optional).
- Nút Hủy + Nút "Lưu".

---

## 9. INBOX / NOTIFICATIONS (Hộp thư – `/inbox`)

### 9.1 Header & Phân loại

- Tiêu đề + `"Bạn có X thông báo chưa đọc"`.
- **Tabs lọc**: Tất cả / Chưa đọc (badge số) / Nhắc tên (`mention`) / Được giao (`task_assigned`).
- Nút **"Đánh dấu tất cả đã đọc"**.

### 9.2 Notification Item

Mỗi thông báo:
- **Avatar** người thực hiện (ảnh hoặc initials + nền màu).
- **Nội dung**: `[Tên] [hành động] "[target]"` + preview chi tiết (bình luận, emoji,...).
- **Thời gian tương đối** (`vừa xong` / `3 phút trước` / `2 ngày trước`,...).
- **Icon loại** (phải): 💬 cam (comment/mention/reply), 👍 xanh (reaction), 👤 tím (task_assigned/project_added), ✅ xanh dương (status_changed), ⏰ đỏ (deadline), ⭐ xanh lá (evaluation).
- **Nền unread** (`.unread` class): Background sáng hơn.
- Click → Đánh dấu đã đọc + điều hướng:
  - Type `evaluation` → `/evaluations`.
  - Có `project_id` → `/projects/:project_id?task_id=:task_id` (tự động mở Task Detail Panel).

### 9.3 Real-time & Infinite Scroll

- Lắng nghe event `notification-received-global` (dispatch từ Header khi nhận WebSocket) → prepend notification mới lên đầu.
- Polling 30 giây để refresh khi tab không active.
- Infinite scroll (window scroll listener) tải thêm thông báo cũ hơn.
- Hiển thị `"Đã tải hết thông báo"` ở cuối khi không còn dữ liệu.

---

## 10. MEMBERS (Quản lý thành viên – `/members`)

### 10.1 Danh sách thành viên

**Toolbar:**
- Ô tìm kiếm (theo tên/email, nút X xóa nhanh).
- Dropdown lọc **Phòng ban** (sync từ Bitrix24).
- Dropdown lọc **Vai trò** (Tất cả / Admin / Manager / Employee).

**Bảng thành viên (Columns):**
- **Thành viên**: Avatar + tên + email.
- **Phòng ban**: Tags phòng ban (>2 thì hiển thị `+N` kèm Tooltip chi tiết khi hover).
- **Vai trò**: Badge màu (admin/manager/employee).
- **Công việc**: Progress bar (% hoàn thành) + `done/total`.
- **Trạng thái**: Dot + label (`active` xanh / `inactive` xám).
- **Hành động `⋮`**: Xem chi tiết / Chỉnh sửa (chỉ SuperAdmin, ngoại trừ user ID 632).

**Phân trang:**
- Nút prev/next ở cuối bảng.
- Dropdown số dòng/trang (10/20/50/100), lưu vào `localStorage`.

### 10.2 Member Detail Drawer (Profile Drawer)

Slide từ phải khi click member.

**Header:**
- Avatar lớn, tên, vai trò.
- Email, phone, ngày tham gia workspace.
- Nút Edit (chỉ SuperAdmin).

**Stats Grid:**
- Tổng task / Task đang làm / Tỷ lệ hoàn thành / Task đã xong.

**Tabs:**
- **Công việc**: Danh sách task (chấm màu status, tên task, tên project, due date).
- **Đánh giá**: Danh sách kỳ đánh giá: điểm số, badge xếp loại, tên evaluator.

---

## 11. EVALUATIONS (Đánh giá hiệu suất – `/evaluations`)

### 11.1 Phân quyền

- **Manager/Admin**: Xem tất cả, tạo kỳ mới, chỉnh sửa và publish đánh giá.
- **Employee**: Chỉ xem đánh giá của bản thân đã được publish (read-only).

### 11.2 Header & Summary

- Tiêu đề + tên kỳ đang xem.
- Nút **"+ Tạo kỳ đánh giá mới"** (chỉ Manager/Admin): Gọi API `generateEvaluations(period)` để tự động tính toán và tạo bản ghi đánh giá cho kỳ được chọn.
- **Summary Cards**: Tổng nhân viên / Đã công bố (xanh lá) / Chưa đánh giá/Bản nháp (vàng) / Điểm trung bình (tím).

### 11.3 Toolbar

- Dropdown **Chọn kỳ** (định dạng `Tháng M năm YYYY`, ví dụ: "Tháng 5 năm 2026"). Danh sách periods từ API.
- Lọc nhanh: **Tất cả** / **Bản nháp** (`draft`) / **Đã công bố** (`published`).

### 11.4 Bảng đánh giá

Columns:
- **Nhân viên**: Avatar màu + tên + phòng ban.
- **Số task hoàn thành**: `completed/total`.
- **Đúng hạn**: % on_time_rate (màu: xanh ≥80%, vàng ≥60%, đỏ <60%).
- **Điểm gợi ý**: `total_score` (màu: xanh lá ≥8, xanh dương ≥6, vàng ≥4, đỏ <4).
- **Xếp loại**: Badge emoji + label (⭐ Xuất sắc ≥9 / ✅ Tốt ≥7 / 🔵 Khá ≥5 / 🟡 Trung bình ≥3 / 🔴 Yếu <3).
- **Trạng thái**: `draft` / `published`.
- Nút **"Xem chi tiết →"**.
- Infinite scroll (Intersection Observer, 10 dòng/trang).

### 11.5 Evaluation Detail Drawer

Click dòng hoặc "Xem chi tiết" → Slide drawer phải.

**Task Summary:**
- 4 thẻ: Tổng task / Đã hoàn thành / Đúng hạn / Chưa hoàn thành.
- Bảng danh sách task trong kỳ: Tên task, Hạn chót, Ngày hoàn thành, Trạng thái (dot xanh = on-time, dot đỏ = late).

**Kết quả đánh giá:**
- Điểm số `/10` + badge xếp loại màu sắc.

**Nhận xét:**
- **Draft**: Textarea editable cho Manager.
- **Published**: Text tĩnh (read-only).

**Footer** (chỉ hiển thị khi Draft, chỉ Manager/Admin):
- Nút **Lưu nháp**: Lưu comment, giữ status draft.
- Nút **Công bố**: Publish, gửi notification in-app cho nhân viên, khóa chỉnh sửa.

---

## 12. ANALYTICS / REPORTS (Báo cáo & Phân tích – `/analytics`)

### 12.1 Toolbar & Xuất dữ liệu

- Dropdown **Lọc dự án**: All Projects / một project cụ thể.
- Nút **Xuất CSV** (`Export`): Tạo file CSV UTF-8 BOM (không lỗi font Excel). Nội dung: tổng quan theo status, theo priority, workload từng member, bảng team performance chi tiết.

### 12.2 Biểu đồ (Recharts)

- **Donut Chart**: Tỷ lệ task theo trạng thái (Done / In Progress / Review / Todo / Overdue).
- **Priority Bar Chart**: Số task theo priority (Urgent / High / Medium / Low / None). Bar đứng.
- **Line Chart (Xu hướng)**: So sánh task được tạo vs task hoàn thành theo tuần gần đây.
- **Horizontal Bar Chart (Workload)**: Số task chưa hoàn thành của từng member. Cột ngang.
- **Progress Circle**: % hoàn thành + số liệu chi tiết từng status.

### 12.3 Team Performance Table

Columns: Avatar + Tên / Tổng task / Đã xong / Tỷ lệ đúng hạn % (màu tự động) / Thời gian xử lý trung bình.

---

## 13. SETTINGS (Cài đặt – `/settings`)

### 13.1 Profile (Thông tin cá nhân)

- Hiển thị thông tin từ Bitrix24: avatar, tên, email, phone, work_position.
- Ghi chú: `"Thông tin hồ sơ được đồng bộ từ Bitrix24, không thể chỉnh sửa trực tiếp."`.

### 13.2 Thông báo (Notifications)

5 toggle switches bật/tắt nhận notification (in-app và/hoặc email):
- Khi được giao task mới (`taskAssigned`).
- Khi có bình luận mới (`taskComment`).
- Khi task sắp đến hạn (`deadline`).
- Khi kết quả đánh giá được công bố (`evaluation`).
- Khi dự án có cập nhật (`projectUpdate`).

Lưu qua API `PUT /api/auth/settings` → sync xuống DB (`notification_settings` JSON field).

### 13.3 Giao diện (Appearance)

3 lựa chọn theme:
- **Sáng (Light)** ☀️.
- **Tối (Dark)** 🌙.
- **Hệ thống (System)** 💻.

Áp dụng ngay lập tức: cập nhật class CSS trên `<html>`, sync qua `theme-changed` event, lưu `localStorage` + API.

### 13.4 Không gian làm việc (Workspace)

- **Tên workspace**: Input text, lưu vào `localStorage['taskflow_workspace_name']` + API.
- **Múi giờ**: Dropdown danh sách timezones (Asia/Ho_Chi_Minh, America/New_York, Europe/London,...). Lưu `localStorage['taskflow_timezone']` + API.
- **Ngôn ngữ**: Dropdown: Tiếng Việt (`vi`) / English (`en`) / 日本語 (`ja`). Áp dụng ngay, lưu `localStorage['taskflow_lang']` + API.

### 13.5 Task Templates

- Danh sách các template task đã tạo.
- Mỗi template: Tên, type, priority, description, danh sách checklist, subtasks.
- Nút tạo template mới / chỉnh sửa / xóa.
- Template được sử dụng khi tạo task mới (dropdown chọn template trong `CreateTaskModal`).

---

## 14. GLOBAL SEARCH (`SearchModal.tsx`)

- Mở bằng click vào search bar header hoặc `Cmd+K` / `Ctrl+K`.
- Ô nhập tìm kiếm với debounce.
- Kết quả nhóm theo loại: **Tasks** / **Projects** / **Members**.
- Gợi ý realtime khi gõ (gọi API `/api/search`).
- Click kết quả → điều hướng tới màn hình tương ứng (project detail, task detail, member).

---

## 15. AI ASSISTANT (Trợ lý AI)

### 15.1 Global AI Sidebar (`GlobalAiSidebar.tsx`)

- Panel trượt từ cạnh phải màn hình (không liên kết với task cụ thể).
- Chat AI tổng quát (gọi API `/api/ai/global/chat` dùng Gemini API).
- Hỗ trợ: hỏi đáp, gợi ý kế hoạch, sinh nội dung,...

### 15.2 Task-level AI (Trong Task Detail Panel)

Các nút "✨ Viết bằng AI" / "AI →" xuất hiện ở:
- **Mô tả (Description)**: Gọi `/api/tasks/{id}/ai/description` → AI viết/tóm tắt mô tả dựa trên tiêu đề và context.
- **Subtasks**: Gọi `/api/tasks/{id}/ai/subtasks` → AI sinh danh sách subtask gợi ý.
- **Checklists**: Gọi `/api/tasks/{id}/ai/checklist` → AI sinh danh sách checklist gợi ý.
- **Chat trong task**: Gọi `/api/tasks/{id}/ai/chat` → Chat AI trong ngữ cảnh task cụ thể.

---

## 16. PHÍM TẮT (Keyboard Shortcuts)

| Phím | Hành động |
|------|-----------|
| `Cmd+K` / `Ctrl+K` | Mở Global Search |
| `Esc` | Đóng modal/panel/drawer |

---

## 17. REALTIME & EVENTS (WebSocket & Custom Events)

### WebSocket Channels (Laravel Echo / Reverb)

- **Private channel** `App.Models.User.{userId}`:
  - `.notification.received` → Hiển thị toast + cập nhật badge.
  - `.timer.updated` → Refresh timer data, sync server time offset.
- **Project channel** (xem qua `getEcho()` trong ProjectDetailPage):
  - `TaskUpdated` event → Cập nhật danh sách task realtime khi thành viên khác thay đổi.
  - `TimeTrackingUpdated` event → Cập nhật timesheet realtime.

### Custom Window Events

| Event | Mô tả |
|-------|-------|
| `timer-updated` | Refresh timer data ở Header và Timesheet |
| `projects-changed` | Refresh danh sách project ở Sidebar |
| `unread-count-changed` | Cập nhật badge inbox ở Sidebar/Header |
| `notification-received-global` | Prepend notification mới vào Inbox |
| `open-create-task-modal` | Mở Global Create Task Modal |
| `open-global-search` | Mở Global Search Modal |
| `theme-changed` | Áp dụng theme mới toàn bộ UI |
| `language-changed` | Áp dụng ngôn ngữ mới |

---

## 18. ĐA NGÔN NGỮ (i18n)

- Hỗ trợ: **Tiếng Việt** (`vi`), **English** (`en`), **日本語** (`ja`).
- Utility `useTranslation()` trả về `{ t, lang, locale }`.
- Tất cả text UI đều dùng key dịch, không hardcode tiếng Việt trong component (ngoại trừ một số fallback).
- Ngôn ngữ được sync từ DB user → localStorage → UI khi load.

---

*Cập nhật lần cuối: 2026-06-08 | Phiên bản: Scan codebase thực tế đầy đủ*
