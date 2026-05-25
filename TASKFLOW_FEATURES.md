# TASKFLOW – MÔ TẢ CHI TIẾT CHỨC NĂNG

## SIDEBAR (Thanh điều hướng trái)

**Luôn hiển thị, thu gọn được (icon-only mode)**

| Icon | Mục           | Mô tả                    |
| ---- | -------------- | -------------------------- |
| 🏠   | Home/Dashboard | Trang tổng quan           |
| 📋   | Projects       | Danh sách dự án         |
| ✅   | My Tasks       | Task được giao cho tôi |
| 📥   | Inbox          | Thông báo & yêu cầu    |
| 📊   | Analytics      | Báo cáo & thống kê     |
| ⭐   | Evaluations    | Đánh giá nhân viên    |
| 👥   | Members        | Quản lý nhân viên      |
| ⚙️ | Settings       | Cài đặt hệ thống      |

**Phần "Projects" trong sidebar:**

- Hiển thị danh sách dự án lấy động từ API backend `/projects`
- Mỗi dự án: màu dot + tên + badge số task active (số task chưa ở trạng thái 'done')
- Nhấn dự án → chuyển hướng trực tiếp đến trang chi tiết dự án `/projects/:id`
- Nút **"+ New Project"** ở cuối danh sách mở form tạo dự án mới tại `/projects?create=true`

---

## 1. DASHBOARD (Trang chủ)

### Layout

- Header: breadcrumb + nút tạo nhanh **"+ New"** (dropdown)
- Body: grid widgets 2-3 cột

### Widgets cho Manager/Admin

| Widget                       | Nội dung                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| **Overview cards**     | Tổng dự án / Task đang chạy / Task trễ hạn / Thành viên |
| **My assigned tasks**  | Danh sách task tôi đang phụ trách, click → mở task detail |
| **Team workload**      | Bar chart mỗi nhân viên đang có bao nhiêu task             |
| **Upcoming deadlines** | Task sắp hết hạn trong 7 ngày                                |
| **Recent activity**    | Feed hoạt động mới nhất của team                           |
| **Project progress**   | Thanh tiến độ % từng dự án                                 |

### Widgets cho Employee

| Widget                      | Nội dung                                           |
| --------------------------- | --------------------------------------------------- |
| **My tasks today**    | Task cần làm hôm nay                             |
| **In progress**       | Task đang thực hiện                              |
| **Upcoming**          | Task sắp đến deadline                            |
| **My stats**          | Tổng task tháng này / Hoàn thành / Đúng hạn |
| **Latest evaluation** | Điểm đánh giá kỳ gần nhất                   |

### Tương tác

- Click vào task bất kỳ → mở **Task Detail Panel** (slide từ phải)
- Click **"View all"** → chuyển sang trang danh sách tương ứng
- Các card số liệu clickable → filter về trang liên quan

---

## 2. PROJECTS (Quản lý dự án)

### 2.1 Trang danh sách dự án

**Header:**

- Tiêu đề "Projects"
- Toggle view: **Grid** 🔲 | **List** ☰
- Nút **"+ Create Project"** (màu primary, góc phải)

**Grid view – mỗi project card hiển thị:**

- Màu + tên dự án
- Mô tả ngắn (2 dòng, truncate)
- Progress bar (% task done)
- Deadline
- Avatar stack (thành viên)
- Badge trạng thái: Active / On Hold / Completed
- Menu **⋮** → {Edit, Archive, Delete}

**List view – các cột:**

- Tên | Trạng thái | Tiến độ | Deadline | Thành viên | Hành động

**Filter bar:**

- Dropdown: Status (All / Active / On Hold / Completed)
- Dropdown: Sort by (Name / Deadline / Progress / Created date)

---

### 2.2 Tạo dự án mới

Nhấn **"+ Create Project"** → mở **Modal "Create Project"**

**Form gồm:**

```
[Chọn màu/icon] [Tên dự án *]
[Mô tả] (rich text editor nhỏ)
[Ngày bắt đầu] [Ngày kết thúc]
[Network]: Secret (private) / Public
[Members]: Multi-select search nhân viên
[Identifier]: Prefix tự động (VD: ACME) – editable
```

**Nút footer:**

- **"Cancel"** → đóng modal
- **"Create Project"** → tạo + redirect vào trang chi tiết dự án

---

### 2.3 Chi tiết dự án

**Tab bar (ngang, phía trên):**

| Tab                | Nội dung                                          |
| ------------------ | -------------------------------------------------- |
| **Board**          | Bảng quản lý công việc Kanban                      |
| **Members**        | Danh sách thành viên dự án                         |

*Lưu ý: Tab Settings của dự án đã được gỡ bỏ hoàn toàn. Chức năng chỉnh sửa thông tin dự án (bao gồm thời gian bắt đầu, ngày kết thúc) và chức năng Xóa dự án đã được tích hợp vào Modal "Edit Project Details".*

---

### 2.4 Tab: Issues (Danh sách task trong dự án)

**Header:**

- Tên dự án + tab name
- Toggle: **List** / **Board** / **Calendar**
- Nút **Filter** 🔽 → panel filter bên phải
- Nút **Display** ⚙ → tùy chỉnh cột hiển thị
- Nút **"+ Add work item"** (primary)

**List view – groupby status (Backlog / To Do / In Progress / Done):**

- Mỗi group: tiêu đề group + badge số lượng + nút **"+"** thêm task inline
- Mỗi row task hiển thị:
  - Checkbox trạng thái (click để cycle qua: Todo→InProgress→Done)
  - ID task (VD: ACME-23) – màu theo priority
  - Tiêu đề task (click → mở detail panel)
  - Labels/Tags (chips màu)
  - Assignee avatar (click → filter)
  - Deadline (đỏ nếu quá hạn)
  - Priority icon
  - Nút **⋮** (hover) → {Edit, Duplicate, Delete, Copy link}

**Filter panel (khi nhấn Filter):**

- Priority: Urgent / High / Medium / Low / None
- Assignee: Multi-select nhân viên
- Label: Multi-select labels
- Due date: None / Today / This week / Overdue / Custom range
- Created by

---

### 2.5 Tab: Board (Kanban)

- Các cột ngang: **To Do | In Progress | Review | Done**
- Chỉ cột **To Do** mới hiển thị nút **"+"** ở header và nút **"Add task"** ở cuối cột. Các task mới bắt buộc phải được tạo trong cột **To Do**.

**Mỗi task card:**

```
[Priority dot] [ID]
[Tiêu đề task]
[Avatar assignee]
```

**Tương tác:**

- **Kéo thả** card sang cột khác hoặc cập nhật từ dropdown để thay đổi trạng thái công việc.
- **Ràng buộc cập nhật tuần tự**: Trạng thái công việc bắt buộc phải đi theo đúng luồng tuần tự: **To Do -> In Progress -> Review -> Done**. Hệ thống (cả Frontend và Backend) sẽ ngăn chặn và báo lỗi nếu có hành vi thay đổi trạng thái không tuần tự hoặc nhảy vọt.
- **Click card** → mở Task Detail Panel (slide từ phải).

---

### 2.6 Tab: Cycles (Sprint)

- Danh sách các Cycle (sprint): tên, ngày chạy, số task, progress %
- Nút **"+ New Cycle"** → modal tạo cycle
- **Active cycle**: highlighted, hiển thị Burndown chart
- Nhấn vào cycle → xem toàn bộ task trong cycle + kéo thả task vào/ra
- Trạng thái cycle: Draft / Active / Completed

---

### 2.7 Tab: Modules (Epic/Feature groups)

- Nhóm task theo chức năng lớn (VD: Authentication, Dashboard, Reports)
- Nút **"+ New Module"**
- Mỗi module: tên, progress bar, số task, deadline, lead
- Nhấn vào module → xem task bên trong

---

### 2.8 Tab: Members

**Bảng thành viên:**

| Avatar | Tên | Email | Role trong project | Task đang có | Ngày thêm | Action |
| ------ | ---- | ----- | ------------------ | -------------- | ----------- | ------ |
| ...    | ...  | ...   | Manager / Member   | 5              | 01/05       | ⋮     |

**Nút "Invite Members"** → modal tìm kiếm nhân viên + chọn role → **"Add"**

**Role trong project:**

- **Manager**: full quyền trong project
- **Member**: tạo/sửa task của mình, không xóa project

---

## 3. MY TASKS (Task của tôi)

### Header

- Tiêu đề "My Tasks"
- Filter nhanh: **All / Today / This Week / Overdue / No Date**
- Toggle: List / Board

### Groupby

- Mặc định group theo **Priority**: Urgent / High / Medium / Low
- Option group: theo Project / Status / Due date

### Mỗi task row

```
[Status checkbox]  [Priority]  [Tên task]  [Project badge]  [Deadline]  [⋮]
```

- Click **status checkbox** → cycle trạng thái
- Click **tên task** → mở Task Detail
- Click **⋮** → {Mark done, Reassign, Set deadline, Delete}

---

## 4. TASK DETAIL (Chi tiết task)

Mở dưới dạng **right panel slide-in**.

### Layout 2 cột

**CỘT TRÁI (nội dung chính):**

```
[Mã số công việc: #ID]
[Tiêu đề task - Nhập văn bản trực tiếp]
[Mô tả task - Nhập văn bản trực tiếp]

[Nút "Save Changes" - Lưu toàn bộ thay đổi ở cả cột trái và cột phải]

[Tab bar: Bình luận | Lịch sử hoạt động]
  - Bình luận: Đăng bình luận dạng văn bản kèm tải lên hình ảnh chứng minh (Proof Attachment).
  - Lịch sử hoạt động: Timeline log chi tiết ghi lại toàn bộ hoạt động CRUD, thay đổi người phụ trách, thời gian, trạng thái, người cập nhật,...
```

**CỘT PHẢI (metadata):**

```
[Status]        dropdown: To Do / In Progress / Review / Done
[Priority]      dropdown: Low / Medium / High
[Assignees]     dropdown chọn thành viên tham gia dự án
[Estimated Hours] Input số giờ ước tính
[Actual Hours]  Input số giờ thực tế
[Start date]    Date picker
[Due date]      Date picker (Hạn chót)

[Nút hành động]
[Delete Task]   Xóa công việc (có xác nhận)
```

*Lưu ý: Tất cả các thao tác xóa dự án và xóa công việc đều được thực hiện dưới dạng Soft Delete (xóa mềm) bằng cách cập nhật trường `deleted_at` trong cơ sở dữ liệu.*

---

## 5. TẠO TASK MỚI

**Cách 1: Quick create** – nhấn **"+"** trong Kanban cột → inline form nhỏ:

```
[Input tiêu đề] [Assignee] [Due date] [Enter để tạo]
```

**Cách 2: Full create** – nhấn **"+ Add work item"** → mở **Modal lớn**:

```
[Tiêu đề *]
[Mô tả] (rich editor)
[Status]  [Priority]
[Assignee]  [Due date]
[Labels]  [Module]  [Estimate]
[Attach files]
[Sub-tasks: + Add item]
[Cancel]  [Create Issue]
```

**Cách 3: Global** – nhấn **"+ New"** ở header → dropdown → **"Task"**

---

## 6. GIAO TASK (Manager → Employee)

### Từ Task Detail

1. Manager mở task → nhấn vào **"Assignees"**
2. Dropdown hiện ra danh sách nhân viên trong project
3. Search theo tên
4. Click nhân viên → assign (có thể assign nhiều người)
5. Hệ thống:
   - Cập nhật assignee trên task
   - Gửi in-app notification cho nhân viên
   - Ghi vào Activity: *"Manager A assigned this task to Employee B"*
   - Email notification (optional, cấu hình được)

### Từ Board/List view

- Hover vào task → click avatar slot → dropdown chọn người

### Bulk assign (Manager)

- Tick checkbox nhiều task → toolbar xuất hiện ở bottom
- **"Assign"** → chọn nhân viên → apply cho tất cả đã chọn

---

## 7. INBOX / NOTIFICATIONS

### Header Inbox

- Tab: **All / Mentions / My Issues / Created / Watching**
- Nút **"Mark all read"**
- Filter: Read / Unread

### Mỗi notification item

```
[Avatar người thực hiện]
[Tên] đã [hành động] [task/project]
[Thời gian: "5 minutes ago"]
[Dot xanh nếu chưa đọc]
```

**Loại notification:**

- Task được giao cho bạn
- Task của bạn được comment → mention @bạn
- Task bạn watch có cập nhật
- Task của bạn sắp deadline (24h, 2h)
- Task bị đổi priority/status
- Bạn được add vào project
- Manager đã đánh giá bạn

**Click notification** → navigate đến task/màn hình liên quan

---

## 8. MEMBERS (Quản lý nhân viên) – Admin/Manager

### 8.1 Danh sách nhân viên

**Header:**

- Search box: tìm theo tên, email
- Filter: Role (All/Admin/Manager/Employee) | Department | Status
- Nút **"+ Invite Member"**

**Bảng:**

| Avatar | Tên | Email | Phòng ban | Role | Task active | Trạng thái | ⋮ |
| ------ | ---- | ----- | ---------- | ---- | ----------- | ------------ | -- |

**Menu ⋮ mỗi nhân viên:**

- View profile
- Edit info
- Change role
- Deactivate account
- Remove from workspace

---

### 8.2 Profile nhân viên

**Header:** Avatar lớn, tên, role, phòng ban, email, trạng thái

**Tabs:**

**Tab "Overview":**

- Stats cards: Task tháng này / Hoàn thành / Đúng hạn / Trễ hạn
- Biểu đồ completion rate theo tháng (Line chart)

**Tab "Tasks":**

- Danh sách task được giao
- Filter: Status / Project / Priority
- Mỗi row: Task name, Project, Status, Priority, Deadline

**Tab "Evaluations":**

- Danh sách kỳ đánh giá
- Mỗi row: Tên kỳ | Điểm tổng | Xếp loại | Người đánh giá | Ngày
- Click → xem chi tiết đánh giá

---

## 9. EVALUATIONS (Đánh giá nhân viên)

### 9.1 Trang Evaluations (Manager/Admin)

**Header:**

- Tiêu đề "Evaluations"
- Dropdown chọn kỳ đánh giá (VD: "Q2 2026 – Tháng 4-6")
- Nút **"+ New Evaluation Period"**

**Danh sách nhân viên cần đánh giá:**

| Avatar | Tên      | Phòng ban | Task done | Đúng hạn% | Điểm gợi ý | Trạng thái | Action      |
| ------ | --------- | ---------- | --------- | ------------ | -------------- | ------------ | ----------- |
| ...    | Nguyễn A | Dev        | 18/22     | 82%          | 7.5/10         | Draft        | Đánh giá |

**Trạng thái:** Draft (chưa đánh giá) / In Review (đang soạn) / Published (đã gửi)

---

### 9.2 Form đánh giá chi tiết (Manager)

Nhấn **"Đánh giá"** → mở trang đánh giá đầy đủ

**Phần 1 – Tổng hợp task tự động:**

```
[Kỳ: Tháng 5/2026]  [Nhân viên: Nguyễn Văn A]

Thống kê task:
┌─────────────────────────────────────────────────────┐
│ Tổng task: 22  │ Hoàn thành: 18  │ Đúng hạn: 15    │
│ Trễ hạn: 3     │ Chưa xong: 4    │ Tỉ lệ: 81.8%    │
└─────────────────────────────────────────────────────┘

Bảng chi tiết từng task:
| Task | Deadline | Hoàn thành | Trạng thái |
| Fix login bug | 05/05 | 04/05 | ✅ Đúng hạn |
| Design homepage | 10/05 | 13/05 | ❌ Trễ 3 ngày |
```

**Phần 2 – Tiêu chí chấm điểm (Manager nhập):**

| Tiêu chí                | Điểm (1-10) | Thanh slider         |
| ------------------------- | ------------- | -------------------- |
| Chất lượng công việc | [  7  ]       | ████████░░ |
| Tinh thần trách nhiệm  | [  8  ]       | █████████░ |
| Giao tiếp & phối hợp   | [  7  ]       | ████████░░ |
| Sáng tạo & đề xuất   | [  6  ]       | ██████░░░░ |
| Chấp hành quy định    | [  9  ]       | █████████░ |

**Phần 3 – Nhận xét:**

```
[Textarea - nhận xét tổng quát của Manager]
VD: "Anh A hoàn thành tốt các task phức tạp, cần cải thiện deadline..."

[Điểm tổng: 7.4/10]  [Xếp loại: Tốt ✅]
```

**Xếp loại tự động:**

- 9-10: ⭐ Xuất sắc
- 7-8.9: ✅ Tốt
- 5-6.9: 🔵 Khá
- 3-4.9: 🟡 Trung bình
- <3: 🔴 Yếu

**Nút footer:**

- **"Lưu nháp"** → lưu, chưa gửi cho nhân viên
- **"Publish"** → gửi chính thức, nhân viên nhận notification, không sửa được nữa

---

### 9.3 Xem đánh giá (Employee – Read only)

Menu **"My Evaluations"** → danh sách kỳ:

| Kỳ           | Điểm | Xếp loại | Người đánh giá | Ngày publish |
| ------------- | ------ | ---------- | ------------------- | ------------- |
| Tháng 5/2026 | 7.4/10 | Tốt       | Trần Manager       | 20/06/2026    |

Click vào kỳ → xem chi tiết:

- Toàn bộ thống kê task
- Từng tiêu chí điểm + thanh progress
- Nhận xét của Manager
- Điểm tổng + xếp loại

---

## 10. ANALYTICS / REPORTS

### 10.1 Trang Analytics

**Filter header:**

- Chọn Project (All hoặc cụ thể)
- Chọn khoảng thời gian (This week / This month / Last 3 months / Custom)
- Chọn thành viên

**Charts:**

| Chart                 | Loại          | Nội dung                              |
| --------------------- | -------------- | -------------------------------------- |
| Task overview         | Donut chart    | Todo / In Progress / Done / Overdue    |
| Task completion trend | Line chart     | Số task done theo ngày/tuần         |
| Team workload         | Horizontal bar | Mỗi người đang có bao nhiêu task |
| Priority distribution | Bar chart      | Urgent/High/Medium/Low                 |
| Burndown chart        | Line chart     | Task còn lại theo ngày trong cycle  |
| Project progress      | Progress bars  | % done từng dự án                   |

### 10.2 Báo cáo nhân viên

- Table: Tên | Tổng task | Hoàn thành | Đúng hạn% | Trễ | Avg completion time
- Sort theo cột
- Nút **"Export Excel"** và **"Export PDF"**

---

## 11. SETTINGS

### 11.1 Workspace Settings (Admin)

**Tabs:**

- **General**: Tên workspace, logo, timezone, language
- **Members**: Danh sách thành viên toàn workspace + invite
- **Roles & Permissions**: Cấu hình quyền cho từng role
- **Departments**: CRUD phòng ban

### 11.2 Project Settings (Manager)

- **General**: Tên, mô tả, identifier, network, màu
- **Members**: Thêm/xóa thành viên + đổi role
- **Labels**: Tạo label màu sắc riêng cho project
- **Workflows**: Tùy chỉnh các cột status
- **Archive / Delete project**

### 11.3 Profile Settings (Tất cả user)

- **Profile**: Sửa avatar, tên, bio, phone
- **Account**: Đổi email, đổi mật khẩu
- **Notifications**: Bật/tắt từng loại thông báo (email, in-app)
- **Theme**: Light / Dark / System

---

## 12. GLOBAL SEARCH

- Nhấn **Search bar** ở header hoặc phím tắt `Cmd+K`
- Tìm kiếm: Tasks / Projects / Members / Comments
- Gợi ý realtime khi gõ
- Kết quả nhóm theo loại
- Click kết quả → navigate đến màn hình

---

## 13. PHÍM TẮT (Keyboard Shortcuts)

| Phím     | Hành động                            |
| --------- | --------------------------------------- |
| `Cmd+K` | Mở global search                       |
| `C`     | Tạo task mới (khi không focus input) |
| `P`     | Chuyển trang Projects                  |
| `M`     | Chuyển trang My Tasks                  |
| `Esc`   | Đóng modal/panel                      |
