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

Trang tổng quan cung cấp cái nhìn toàn diện về các chỉ số dự án, công việc cá nhân, tiến độ chung và các hoạt động mới nhất của đội ngũ.

### 1.1 Khung lời chào động (Personalized Greeting)

- Hiển thị lời chào cá nhân hóa động ở đầu trang dựa trên thời gian thực trong ngày (Sáng ☀️, Trưa ☕, Chiều ☀️, Tối 🌙).
- Nội dung câu chào được chọn ngẫu nhiên từ danh sách các câu chào độc đáo (4 mẫu câu chào khác nhau cho mỗi khoảng thời gian trong ngày) bằng cả Tiếng Việt và Tiếng Anh tùy theo ngôn ngữ hệ thống hiện tại.
- Kèm theo dòng tóm tắt số lượng công việc đang hoạt động của người dùng (ví dụ: `Bạn đang có X công việc cần xử lý.`).

### 1.2 Khung thẻ chỉ số (Overview Stat Cards)

Hệ thống cung cấp 4 thẻ số liệu thống kê lớn, hỗ trợ click chuột để chuyển hướng và lọc nhanh:

- **Tổng dự án (Total Projects)**: Tổng số dự án hiện có trong hệ thống. Click để chuyển hướng tới danh sách dự án `/projects`.
- **Đang làm (Active Tasks)**: Số lượng công việc chưa ở trạng thái 'Hoàn thành' (Done). Click để chuyển hướng tới `/my-tasks?filter=active`.
- **Trễ hạn (Overdue Tasks)**: Số lượng công việc có hạn chót trước ngày hiện tại và chưa hoàn thành. Hiển thị badge xu hướng đỏ kèm số lượng cụ thể. Click để chuyển hướng tới `/my-tasks?filter=overdue`.
- **Đã hoàn thành (Completed Tasks)**: Số lượng công việc đã hoàn thành. Hiển thị badge xu hướng xanh lá kèm số lượng cụ thể. Click để chuyển hướng tới `/my-tasks?filter=done`.

### 1.3 Hệ thống Widget chức năng (Dashboard Grid)

Giao diện được tổ chức theo bố cục Grid thông minh 2 cột:

#### Cột Trái (My Tasks & Recent Activity)

- **Công việc (My Tasks)**:
  - Hiển thị danh sách các công việc được giao cho tài khoản hiện tại.
  - Mỗi dòng công việc hiển thị:
    - Dải màu cạnh trái tương ứng với Mức độ ưu tiên (Khẩn cấp `urgent`, Cao `high`, Trung bình `medium`, Thấp `low`, Không ưu tiên `none`).
    - Vòng tròn tiến độ trạng thái: Hiển thị icon dấu tick xanh lục tròn đầy đối với task đã hoàn thành. Đối với task chưa hoàn thành, hiển thị vòng tròn tiến độ vẽ bằng `conic-gradient` tương ứng với vị trí/tỷ lệ của trạng thái hiện tại trong quy trình dự án.
    - Tiêu đề công việc kèm Badge Loại công việc (Task, Bug, Feature).
    - Tên dự án kèm chấm tròn màu đại diện của dự án đó.
    - Ngày hạn chót (tô màu đỏ nếu công việc bị trễ hạn).
    - Avatar của người được giao.
  - Click vào một công việc → Mở Drawer chi tiết công việc (**Task Detail Panel** trượt từ cạnh phải).
  - Nút **"Xem tất cả →"** ở đầu widget để chuyển sang trang `/my-tasks`.
- **Hoạt động gần đây (Recent Activity)**:
  - Hiển thị dòng thời gian các tương tác mới nhất của các thành viên trong đội ngũ.
  - Mỗi dòng hoạt động hiển thị: Avatar người thực hiện, Tên người thực hiện, Hành động tương ứng (đã tạo, đã cập nhật, đã đổi trạng thái, đã giao lại, đã bình luận vào, đã xóa), Tiêu đề công việc đính kèm, Chi tiết thay đổi cụ thể và Thời gian tương đối (ví dụ: `vừa xong`, `15 phút trước`, `2 ngày trước`).

#### Cột Phải (Project Progress & Upcoming Deadlines)

- **Tiến độ dự án (Project Progress)**:
  - Liệt kê các dự án đang hoạt động kèm thanh tiến độ hoàn thành dạng phần trăm (`%`).
  - Thanh tiến độ được tô màu đồng bộ theo màu nhận diện của từng dự án.
  - Click vào một dòng dự án → Chuyển hướng trực tiếp tới trang chi tiết dự án đó (`/projects/:id`).
- **Thời hạn sắp tới (Upcoming Deadlines)**:
  - Danh sách các công việc sắp đến hạn trong vòng 7 ngày tới.
  - Hiển thị tiêu đề công việc, dự án đi kèm và nhãn thời gian thông minh (hiển thị `Hôm nay` nếu hạn chót là ngày hiện tại, hiển thị `Ngày mai` nếu hạn chót là ngày kế tiếp, hoặc hiển thị ngày tháng rút gọn).
  - Click vào một dòng công việc → Mở Drawer chi tiết công việc (**Task Detail Panel**).

---

## 2. PROJECTS (Quản lý dự án)

Hệ thống quản lý, phân bổ và theo dõi các dự án của doanh nghiệp theo hai chế độ xem Grid và List trực quan, hỗ trợ phân quyền và các bộ lọc tìm kiếm mạnh mẽ.

### 2.1 Trang danh sách dự án (Projects Page)

- **Đầu trang (Header)**:
  - Tiêu đề chính: "Dự án" kèm phụ đề hiển thị tổng số lượng dự án (`t('projects.subtitle', { count: totalProjects })`).
  - Nút hành động: **"+ Tạo dự án"** (`Create Project`) màu nổi bật để mở Modal tạo dự án mới.
- **Thanh công cụ (Toolbar)**:
  - Ô tìm kiếm dự án theo tên với cơ chế Debounce tự động (300ms) giúp tối ưu hóa hiệu năng tải dữ liệu.
  - Bộ nút lọc nhanh trạng thái dự án: **Tất cả**, **Đang hoạt động** (Active), **Tạm dừng** (On Hold), **Đã hoàn thành** (Completed).
  - Bộ chuyển đổi chế độ xem (View Toggle) giữa **Lưới (Grid)** 🔲 và **Danh sách (List)** ☰.
- **Chế độ Lưới (Grid View)**:
  - Hiển thị danh sách dự án dưới dạng các thẻ (Cards) trực quan.
  - Mỗi thẻ dự án hiển thị:
    - Dải màu nhận diện dự án chạy ngang đầu thẻ.
    - Icon dự án tùy chỉnh hoặc chữ cái viết tắt tên dự án được bọc trong vòng tròn màu tương ứng.
    - Tên dự án và Mã dự án (`#ID`).
    - Mô tả ngắn của dự án (tự động hiển thị "Không có mô tả" nếu để trống).
    - Thanh tiến độ hoàn thành dạng phần trăm (`%`) được tính toán động dựa trên tỷ lệ số công việc đã xong (`done`) trên tổng số công việc của dự án.
    - Danh sách avatar thành viên tham gia (tối đa hiển thị stack 3 avatar đầu, kèm badge số lượng thành viên dư `+N` nếu có).
    - Badge thông tin thống kê số lượng: công việc đã hoàn thành/tổng số công việc.
    - Hạn chót của dự án (hiển thị màu đỏ nếu quá hạn).
    - Badge trạng thái màu sắc riêng biệt: Đang hoạt động (`active` - màu xanh), Tạm dừng (`on-hold` - màu vàng), Đã hoàn thành (`completed` - màu xanh lá).
    - Nút hành động **Chỉnh sửa** (bút chì ✏️) hiển thị nhanh nếu người dùng có quyền chỉnh sửa dự án (`canEditProject`).
- **Chế độ Danh sách (List View)**:
  - Hiển thị bảng dữ liệu với các cột rõ ràng: Tên dự án (kèm icon và ID), Tiến độ (thanh progress bar + % số), Trạng thái, Thành viên (avatar stack), Hạn chót, và Cột Hành động.
  - Nút menu **⋮** ở cuối dòng mở dropdown cho phép: Chỉnh sửa (Edit) hoặc Xóa (Delete - yêu cầu xác nhận qua hộp thoại xóa của hệ thống).
- **Tải thêm dữ liệu (Infinite Scroll)**:
  - Trang danh sách dự án hỗ trợ tải thêm dữ liệu tự động khi cuộn chuột xuống cuối màn hình dựa trên kích thước trang (12 dự án/trang).

### 2.2 Tạo và Chỉnh sửa dự án (Create/Edit Project Modal)

- **Modal Tạo dự án mới (Create Project)**:
  - **Chọn biểu tượng và màu sắc (ProjectIconPicker)**: Bộ chọn màu sắc chủ đạo và icon đại diện riêng biệt cho từng dự án để dễ dàng nhận diện trên hệ thống.
  - **Tên dự án**: Ô nhập văn bản (bắt buộc, hiển thị dấu `*`).
  - **Mô tả dự án**: Khung nhập thông tin chi tiết.
  - **Thời gian thực hiện**: Ô chọn Ngày bắt đầu và Ngày kết thúc (tự động kiểm tra tính hợp lệ: ngày kết thúc không được nhỏ hơn ngày bắt đầu).
  - **Thành viên (Members)**:
    - Ô chọn thành viên tích hợp tìm kiếm theo tên hoặc email thông qua Popover.
    - Hiển thị danh sách avatar các thành viên đã chọn kèm nút xóa nhanh `x` màu đỏ ở góc avatar.
    - Nếu số lượng thành viên chọn vượt quá 10, các thành viên còn lại sẽ được thu gọn vào badge `+N` dạng popover cho phép xem chi tiết và xóa.
  - **Footer**: Nút hủy (`Cancel`) để đóng modal và nút tạo mới (`Create Project`) màu nổi bật.
- **Modal Chỉnh sửa dự án (Edit Project Modal)**:
  - Cho phép chỉnh sửa toàn bộ các thông tin của dự án hiện tại bao gồm: Icon, màu sắc, tên, mô tả, ngày bắt đầu, ngày kết thúc, trạng thái dự án.
  - Nút **"Xóa dự án"** (chỉ hiển thị đối với Admin hoặc người tạo dự án) kèm hộp thoại xác nhận xóa nhằm tránh thao tác nhầm lẫn gây mất dữ liệu.

### 2.3 Trang Chi tiết dự án (Project Detail Page)

Trang chi tiết dự án được thiết kế với giao diện cao cấp, hiển thị tiêu đề, icon và mã dự án kèm bộ quản lý trạng thái (`Manage Statuses`) ở đầu trang. Nội dung trang được tổ chức thành 3 tab điều hướng ngang:

1. **Công việc (Tasks)**: Quản lý và lập kế hoạch công việc theo 3 chế độ xem: Danh sách (List), Bảng (Board), và Lịch biểu (Calendar).
2. **Bảng công (Timesheet)**: Theo dõi chi tiết thời gian làm việc của các thành viên trong dự án.
3. **Thành viên (Members)**: Quản lý danh sách thành viên dự án và vai trò của họ.

---

### 2.4 Tab: Công việc (Sub-tab Tasks)

Hệ thống quản lý công việc của dự án hỗ trợ bộ lọc mạnh mẽ và 3 chế độ xem linh hoạt:

- **Thanh công cụ lọc và tìm kiếm**:
  - Ô tìm kiếm nhanh công việc theo tiêu đề.
  - Nút lọc nâng cao **Filter** mở Popover 4 danh mục:
    - **Assignee**: Lọc theo người được giao (Giao cho tôi / Tìm thành viên / Không giao cho ai / Chỉ công việc chưa giao).
    - **Status**: Lọc theo trạng thái công việc (chọn nhiều trạng thái).
    - **Priority**: Lọc theo mức độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp).
    - **Type**: Lọc theo loại công việc (Task hoặc Bug).
  - Nút **Nhóm theo (Group By)** (chỉ hỗ trợ khi ở chế độ xem List): Cho phép nhóm danh sách công việc theo **Trạng thái (Status)**, **Độ ưu tiên (Priority)**, hoặc **Hạn chót (Due Date)**.
- **Chế độ xem Danh sách (List View)**:
  - Danh sách công việc được chia nhóm theo cấu hình đã chọn (mặc định nhóm theo Trạng thái). Mỗi nhóm hỗ trợ nút đóng/mở (Collapse/Expand) và nút **"+"** để tạo nhanh công việc inline trong nhóm đó.
  - Mỗi dòng công việc hiển thị:
    - Checkbox trạng thái: Click vào checkbox sẽ tự động thay đổi trạng thái công việc qua các bước tiếp theo trong quy trình.
    - Badge loại công việc: Icon đặc trưng của Task (tích xanh) hoặc Bug (con bọ đỏ).
    - Mã công việc (ví dụ: `ACME-23`) có màu tương ứng theo mức độ ưu tiên.
    - Tiêu đề công việc (click để mở **Task Detail Panel** trượt từ cạnh phải).
    - Nhãn dán công việc (Labels/Tags) dạng chip màu sắc.
    - Avatar của người được giao.
    - Hạn chót của công việc (hiển thị màu đỏ nếu bị trễ hạn).
    - Icon cờ mức độ ưu tiên.
    - Nút hành động **⋮** hiển thị khi hover để mở menu tương tác nhanh (Ghi nhận thời gian, Theo dõi, Đánh dấu hoàn thành, Xóa).
- **Chế độ xem Bảng (Board View - Kanban)**:
  - Phân chia công việc thành các cột trạng thái tương ứng trong dự án (ví dụ: To Do, In Progress, Review, Done).
  - Nút **"Add Task"** ở cuối mỗi cột để tạo nhanh công việc mới thuộc trạng thái đó.
  - Hỗ trợ kéo thả (Drag and Drop) các thẻ công việc (Task Cards) để cập nhật trạng thái trực quan, hoặc cập nhật nhanh qua menu của card.
  - Nhấp chuột vào thẻ công việc để mở panel chi tiết từ cạnh phải.
- **Chế độ xem Lịch biểu (Calendar View)**:
  - Xem mục **2.6** để biết chi tiết tính năng lưới lịch biểu tháng, dải băng công việc (event bars), thuật toán xếp track song song và popover xem nhanh.

---

### 2.5 Tab: Bảng công (Sub-tab Timesheet)

Bảng công tích hợp biểu đồ trực quan giúp theo dõi hiệu quả phân bổ thời gian thực tế:

- **Bộ lọc báo cáo**:
  - Khoảng thời gian: Hôm nay, Tuần này, Tháng này, hoặc Chọn khoảng ngày tùy chỉnh (`Custom`).
  - Thành viên: Lọc bảng công của tất cả thành viên hoặc một thành viên cụ thể.
  - Nút **"Ghi nhận thời gian"** mở modal ghi công việc thủ công.
- **Thẻ chỉ số tổng quan (Timesheet Stats)**:
  - **Tổng giờ (Total Time)**: Tổng số giờ làm việc đã ghi nhận kèm số lượng bản ghi logs.
  - **Tích cực nhất (Most Active)**: Tên thành viên đóng góp nhiều thời gian làm việc nhất cùng số giờ cụ thể.
  - **Tốn thời gian nhất (Most Logged Task)**: Tên công việc tiêu hao nhiều thời gian thực hiện nhất.
- **Biểu đồ phân tích (Recharts)**:
  - Biểu đồ **Thời gian theo thành viên** (Horizontal Bar Chart): So sánh số giờ đóng góp của từng người.
  - Biểu đồ **Thời gian theo công việc** (Pie Chart): Phân tích tỷ trọng thời gian tiêu hao của tối đa 7 công việc hàng đầu.
- **Bảng chi tiết nhật ký thời gian (Time Logs Table)**:
  - Hiển thị các cột: Thành viên (avatar + tên), Công việc (link click mở chi tiết task), Ghi chú/Mô tả, Thời gian bắt đầu, Thời lượng (h), và cột Hành động.
  - Hỗ trợ xóa dòng nhật ký thời gian nếu là Admin hoặc chính người ghi nhận bản ghi đó.

---

### 2.6 Tab: Thành viên (Sub-tab Members)

Trang quản lý nhân sự tham gia dự án:

- **Bảng danh sách thành viên**:
  - Hiển thị danh sách thành viên gồm: Avatar, Tên thành viên, Địa chỉ email, Vai trò trong dự án, Số lượng công việc đang được giao trong dự án này, Ngày tham gia dự án, và Cột Hành động.
- **Phân quyền và Vai trò**:
  - Người tạo dự án được gắn nhãn cố định là **Owner** (Chủ sở hữu).
  - Manager/Admin dự án có quyền thay đổi vai trò của các thành viên khác trực tiếp thông qua hộp chọn dropdown Select (giữa vai trò `Manager` và `Member`). Các thay đổi được đồng bộ ngay xuống cơ sở dữ liệu.
- **Hành động quản lý**:
  - Nút **"Thêm thành viên"** (`Add Member`) để tìm kiếm và mời người dùng khác trong workspace vào dự án.
  - Nút xóa thành viên khỏi dự án kèm hộp thoại xác nhận hủy tư cách thành viên.

---

## 3. MY TASKS (Task của tôi)

Hiển thị toàn bộ các công việc được giao cho người dùng hiện tại (bản thân). Hỗ trợ chuyển đổi qua lại giữa **3 chế độ xem (View modes)**: List (Danh sách), Board (Bảng Kanban), và Calendar (Lịch biểu).

### 3.1 Giao diện và các Bộ lọc chung (Header)

- **Tiêu đề**: "My tasks" kèm dòng mô tả số lượng công việc đang thực hiện.
- **Thanh công cụ**:
  - Ô tìm kiếm nhanh công việc theo tên.
  - Nút **Lọc (Filter)**: Lọc nhanh danh sách công việc theo trạng thái, độ ưu tiên, hoặc loại công việc.
  - Toggle View (góc phải): Cho phép chuyển đổi giữa **Danh sách (List)** ☰, **Bảng (Board)** 🔲, và **Lịch biểu (Calendar)** 📅.

---

### 3.2 Các Chế độ xem chi tiết

#### A. Chế độ Danh sách (List View)

*Là chế độ xem mặc định, hiển thị công việc dạng danh sách phân nhóm.*

- **Tính năng Gom nhóm (Groupby)**: Tương tự như ở trang chi tiết dự án (hỗ trợ nhóm theo Trạng thái, Độ ưu tiên, Hạn chót), ở trang My Tasks người dùng có thể gom nhóm công việc thêm theo tiêu chí **Dự án (Project)** để dễ dàng phân biệt các nguồn công việc:
  - **Độ ưu tiên (Priority)**: Khẩn cấp / Cao / Trung bình / Thấp / Không ưu tiên.
  - **Trạng thái (Status)**: Cần làm / Đang thực hiện / Hoàn thành,...
  - **Dự án (Project)**: Phân nhóm công việc theo từng dự án tham gia.
  - **Hạn chót (Due date)**: Quá hạn / Hôm nay / Tuần này / Tuần tới / Không có hạn chót.
- **Thông tin trên mỗi dòng công việc**:
  - Checkbox trạng thái: Click để thay đổi nhanh trạng thái công việc.
  - Icon loại công việc (Task/Bug).
  - Tiêu đề công việc kèm ID task (click → mở Drawer chi tiết).
  - Tên dự án sở hữu công việc đó kèm dot màu đại diện.
  - Badge trạng thái hiện tại.
  - Hạn chót công việc (hiển thị màu đỏ nếu quá hạn).
  - Avatar của người thực hiện (chính user).
  - Nút **⋮** hành động nhanh → {Xem chi tiết, Theo dõi/Bỏ theo dõi (ẩn đối với các công việc đã gán cho bản thân), Giao lại, Đánh dấu hoàn thành, Ghi nhận giờ làm, Xoá}.

#### B. Chế độ Bảng (Board View)

- **Cấu trúc**: Phân chia công việc thành các cột trạng thái dọc (Cần làm / Đang thực hiện / Hoàn thành).
- **Điểm tương đồng**: Tương tự như Kanban Board của dự án, hỗ trợ kéo thả card để đổi trạng thái nhanh, click card để mở Drawer chi tiết.
- **Điểm khác biệt**: Board này hiển thị các công việc được giao cho bản thân **tổng hợp từ tất cả các dự án khác nhau** đang tham gia chứ không giới hạn trong một dự án duy nhất. Mỗi task card sẽ hiển thị rõ tên dự án bên dưới tiêu đề để nhận biết.

#### C. Chế độ Lịch biểu (Calendar View)

- **Cấu trúc**: Hiển thị lưới ngày tháng (gồm 6 tuần - 42 ngày) đồng bộ qua component `TaskCalendar.tsx`.
- **Điểm tương đồng**: Sử dụng đầy đủ tính năng của Lịch biểu dự án (Chọn tháng/năm, Today, chuyển tháng bằng `<`/`>`, dải băng công việc xếp track song song tránh chồng lấn, popover xem nhanh thông tin khi hover).
- **Điểm khác biệt**: Lịch biểu này hiển thị toàn bộ lịch trình các công việc được giao cho bản thân **thuộc tất cả các dự án** trong hệ thống. Tương tự, nút **"+"** khi hover vào ô ngày cho phép tạo nhanh công việc mới.

---

## 4. TASK DETAIL (Chi tiết task)

Mở dưới dạng **right panel slide-in (Drawer)** từ cạnh phải màn hình.

### Header (Thanh đầu Drawer)

- **Mã số công việc**: Dạng `#ID` của task (ví dụ: `#23`).
- **Mục người theo dõi (Watchers)**:
  - Hiển thị số lượng người theo dõi task: `Người theo dõi ({count})`.
  - **Nút Theo dõi / Bỏ theo dõi (Watch / Unwatch)**: Cho phép user đăng ký nhận notification khi task thay đổi. *Đặc biệt: Ẩn nút theo dõi này nếu task đã được gán cho chính bản thân user (self-assigned tasks) để tránh dư thừa.*
  - **Danh sách avatar**: Hiển thị avatar của các thành viên đang theo dõi task.
- **Hành động xóa task**: Nút icon thùng rác màu đỏ, kích hoạt Modal xác nhận xóa chuyên dụng (`DeleteConfirmModal.tsx`) để thực hiện Soft Delete (Xóa mềm).
- **Nút đóng drawer**: Icon đóng (X) ở góc phải.

### Layout 2 cột chính

#### CỘT TRÁI (Nội dung chính & Thuộc tính):

- **Đường dẫn vị trí (Breadcrumb)**: Tên dự án / Tên task cha (nếu là task con) / Loại task (Task/Bug) + ID.
- **Tương tác loại công việc**: Click vào badge `TaskTypeBadge` để đổi nhanh loại công việc giữa Task và Bug.
- **Tiêu đề công việc (Task Title)**: Nhập văn bản trực tiếp (Tự động co giãn dòng, click để sửa), tự động lưu khi focus out hoặc nhấn Enter.
- **Bảng thuộc tính (Properties Grid)**: Được thiết kế trong một khung xám nền tối premium, bao gồm:
  - **Trạng thái (Status)**: Lựa chọn trạng thái công việc qua `ClickUpStatusPicker`.
  - **Người thực hiện (Assignee)**: Dropdown chọn thành viên tham gia dự án để gán task.
  - **Độ ưu tiên (Priority)**: Flag icon picker lựa chọn mức độ ưu tiên (Khẩn cấp / Cao / Trung bình / Thấp / Không ưu tiên).
  - **Ước tính (Estimate)**: Tự động hiển thị thời gian ước tính dựa trên Start Date và Due Date.
  - **Thời gian (Time)**: Date picker kép để chọn ngày giờ bắt đầu (`start_date`) và hạn chót (`due_date`). Bị khóa không cho sửa khi đã có ghi nhận thời gian bấm giờ để tránh sai lệch dữ liệu.
  - **Theo dõi thời gian (Time Tracking)**: Bộ tính giờ chạy trực tiếp (Time Tracker) với nút Play/Stop hoặc cho phép log tay thủ công (Manual Time Log).
  - **Trường tự định nghĩa (Custom Fields)**: Hiển thị các trường dữ liệu động của dự án (Text, Date, Dropdown, Number, Checkbox...) hỗ trợ chỉnh sửa và xóa trực tiếp.
- **Mô tả công việc (Description)**: Cho phép click để soạn thảo trực tiếp, hỗ trợ tự động lưu.
- **Tính năng Trí tuệ nhân tạo (AI Assistant)**:
  - Nhấp vào nút "Viết bằng AI" (được trang bị tại các phần Mô tả, Công việc con, và Danh sách kiểm tra) để mở khung nhập liệu thông minh (AI Brain modal).
  - Cho phép tự động tạo mô tả chi tiết, sinh danh sách công việc con (subtasks), hoặc lập danh sách kiểm tra (checklists) tối ưu theo ngữ cảnh.
- **Danh sách công việc con (Subtasks)**: Cho phép tạo nhanh task con trực tiếp, hiển thị tiến độ hoàn thành dạng checkbox, giao người làm và đặt độ ưu tiên cho từng task con.
- **Danh sách kiểm tra (Checklists)**: Danh sách kiểm tra có thể tạo nhiều nhóm, check hoàn thành hoặc chuyển đổi checklist item trực tiếp thành subtask hoặc task độc lập.
- **Tài liệu đính kèm (Attachments)**:
  - Kéo thả tệp hoặc click tải file, quản lý tải xuống/đổi tên/xoá file đính kèm.
  - **Xem trước trực tuyến (Preview)**: Tích hợp trình xem trực tiếp các tệp tin dạng hình ảnh (jpg, png, git, webp,...), PDF hoặc tài liệu văn phòng trực tiếp trong Drawer mà không cần tải về máy.

#### CỘT PHẢI (Hoạt động & Thảo luận - Sidebar):

Giao diện tab chuyển đổi linh hoạt:

- **Bình luận (Comments)**: Đăng bình luận dạng văn bản (hỗ trợ Emoji picker, đính kèm hình ảnh/tài liệu và nhắc tên thành viên `@mention`). Hiển thị danh sách bình luận, trả lời (Replies), và thả biểu cảm (Reactions) trên từng bình luận.
- **Lịch sử hoạt động (Lịch sử / Activity History)**: Timeline log chi tiết ghi lại toàn bộ hoạt động CRUD, thay đổi người phụ trách, thời gian, trạng thái, người cập nhật,... giúp theo dõi tiến độ chính xác.

### Tự động lưu (Auto-save)

Mọi chỉnh sửa thuộc tính ở cả cột trái và mô tả/tiêu đề đều được tự động lưu về cơ sở dữ liệu qua các API call tức thời mà không cần nút "Save" thủ công.

*Lưu ý: Tất cả các thao tác xóa dự án và xóa công việc đều được thực hiện dưới dạng Soft Delete (xóa mềm) bằng cách cập nhật trường `deleted_at` trong cơ sở dữ liệu.*

---

## 5. TẠO TASK MỚI

Hệ thống hỗ trợ 3 cách để tạo một công việc mới:

**Cách 1: Tạo nhanh (Quick create)** – Nhấn nút **"+"** trực tiếp tại tiêu đề cột Kanban → hiển thị inline form nhỏ:

```
[Nhập tiêu đề công việc] [Assignee] [Due date] [Nhấn Enter để tạo nhanh]
```

**Cách 2: Tạo đầy đủ (Full create)** – Nhấp vào nút **"+ Tạo mới"** (hoặc nút **"+"** trên ô ngày lịch biểu) → mở **Modal Tạo công việc**:

- **Header (Dòng đầu)**:
  - Dropdown **Chọn dự án...** để chỉ định dự án chứa công việc mới.
  - Dấu phân cách `/`.
  - Dropdown **Loại công việc** chọn nhanh giữa **Công việc (Task)** hoặc **Lỗi (Bug)** kèm icon phân biệt.
- **Nội dung công việc**:
  - Nhập **Tên công việc...** (Trường bắt buộc).
  - Nhập **Viết mô tả hoặc chi tiết công việc...** (Textarea soạn thảo mô tả).
- **Khung thuộc tính (Properties Grid)**: Nằm trong một hộp xám nền nhạt bo góc:
  - **Trạng thái**: Dropdown chọn trạng thái (mặc định hiển thị trạng thái đầu tiên như "CẦN LÀM").
  - **Người thực hiện**: Dropdown chọn thành viên dự án phụ trách công việc.
  - **Độ ưu tiên**: Flag icon picker chọn độ ưu tiên (mặc định hiển thị "Trung bình").
  - **Thời gian**: Chọn khoảng thời gian thực hiện (`Bắt đầu` -> `Hạn chót`).
- **Footer (Nút dưới cùng)**:
  - Nút **Hủy** (Cancel) để đóng modal.
  - Nút **Tạo công việc** (Submit) để hoàn tất việc tạo mới.

**Cách 3: Tạo toàn cục (Global create)** – Nhấp vào nút **"+ Thêm mới"** trên thanh Header chính → chọn **"Task"** từ menu xổ xuống.

---

## 6. GIAO TASK (Manager → Employee)

### Từ Task Detail

1. Manager mở task → nhấn vào **"Assignees"**
2. Dropdown hiện ra danh sách nhân viên trong project
3. Search theo tên
4. Click nhân viên → assign
5. Hệ thống:
   - Cập nhật assignee trên task
   - Gửi in-app notification cho nhân viên
   - Ghi vào Activity: *"Manager A assigned this task to Employee B"*
   - Email notification (optional, cấu hình được)

### Từ Board/List view

- Hover vào task → click avatar slot → dropdown chọn người

## 7. INBOX / NOTIFICATIONS (Hộp thư của tôi)

Trang hiển thị và quản lý toàn bộ các thông báo, cập nhật trong hệ thống liên quan đến người dùng hiện tại.

### 7.1 Giao diện Header Inbox

- **Tiêu đề trang**: "Hộp thư của tôi".
- **Dòng phụ đề**: `Bạn có {count} thông báo chưa đọc` hiển thị trực quan số lượng thông báo unread hiện tại.
- **Thanh phân loại (Tabs)**:
  - **Tất cả**: Hiển thị toàn bộ thông báo.
  - **Chưa đọc**: Chỉ lọc ra các thông báo chưa được đọc (hiển thị kèm badge số lượng unread màu đỏ).
  - **Nhắc tên**: Lọc các thông báo mà bạn được tag nhắc tên (`@mention`) trong bình luận.
  - **Được giao**: Lọc các thông báo liên quan đến việc bạn được giao nhiệm vụ mới (`task_assigned`).
- **Nút hành động nhanh**: Nút **"Đánh dấu tất cả đã đọc"** nằm ở phía bên phải thanh Tabs.

### 7.2 Chi tiết mỗi mục thông báo (Notification Item)

Mỗi thông báo hiển thị là một dòng ngang tương ứng, bao gồm các thành phần:

- **Avatar gửi**: Vòng tròn hiển thị avatar (ảnh đại diện) của người thực hiện hành động, hoặc hiển thị chữ cái viết tắt tên của họ trên nền màu ngẫu nhiên.
- **Nội dung thông báo**:
  - Dạng text: `[Tên người thực hiện] [hành động] [tên công việc hoặc dự án liên quan]`
  - Xem trước (preview): Hiển thị phần nội dung bình luận, phản hồi hoặc cảm xúc sau dấu gạch ngang `—`.
  - Liên kết: Tên công việc (`target`) hiển thị màu tím nổi bật (click để xem chi tiết).
- **Thời gian**: Hiển thị thời gian tương đối ngay dưới nội dung (ví dụ: `3 ngày trước`).
- **Biểu tượng loại hành động (Type Icon)**: Nằm ở ngoài cùng bên phải dòng thông báo, hiển thị icon phân loại đi kèm màu nền mờ:
  - Icon bình luận 💬 nền cam: Đối với hành động viết bình luận, trả lời bình luận, nhắc tên.
  - Icon nút thích 👍 nền xanh dương: Đối với hành động bày tỏ cảm xúc trên bình luận.
  - Icon giao việc 👤 nền tím: Đối với hành động giao việc hoặc thêm vào dự án.
  - Icon check 📋 nền xanh dương: Đối với hành động đổi trạng thái công việc.
  - Icon đồng hồ ⏰ nền đỏ: Đối với thông báo sắp đến hạn chót (deadline).
  - Icon ngôi sao ⭐ nền xanh lá: Đối với thông báo đánh giá kết quả công việc.
- **Trạng thái đọc**: Các thông báo chưa đọc hiển thị với nền sáng nhạt đặc trưng (`.unread`). Khi click vào thông báo, hệ thống tự động đánh dấu đã đọc (làm mờ nền) và chuyển hướng tới công việc liên quan.

### 7.3 Tương tác và Tải thêm dữ liệu

- **Cuộn vô hạn (Infinite Scroll)**: Danh sách thông báo tự động phát hiện cuộn chuột xuống đáy để tải thêm thông báo cũ hơn. Hiển thị dòng chữ `Đã tải hết thông báo` ở cuối danh sách khi đã tải xong toàn bộ.
- **Điều hướng thông minh**: Click vào thông báo sẽ tự động chuyển hướng người dùng đến trang chi tiết:
  - Nếu là thông báo đánh giá: Chuyển đến trang Evaluations (`/evaluations`).
  - Nếu là thông báo thuộc task/project: Chuyển đến trang dự án tương ứng đồng thời tự động kích hoạt slide Drawer mở chi tiết công việc đó (`/projects/:project_id?task_id=:task_id`).

---

## 8. MEMBERS (Quản lý thành viên)

Trang quản lý danh sách thành viên trong hệ thống và theo dõi tiến độ công việc/lịch sử đánh giá của từng cá nhân.

### 8.1 Danh sách thành viên (Members List)

- **Tiêu đề trang**: "Thành viên" kèm tổng số lượng thành viên hiện tại trong hệ thống.
- **Thanh công cụ (Toolbar)**:
  - Ô tìm kiếm: Cho phép tìm kiếm nhanh thành viên theo Tên hoặc Email, có nút "X" để xóa nhanh nội dung tìm kiếm.
  - Bộ lọc phòng ban (Department): Dropdown chọn hiển thị thành viên thuộc một phòng ban cụ thể hoặc Tất cả.
  - Bộ lọc vai trò (Role): Dropdown lọc theo vai trò (Tất cả / Quản trị viên / Quản lý / Nhân viên).
- **Bảng danh sách thành viên (Columns)**:
  - **Thành viên**: Ảnh đại diện (avatar) hoặc chữ cái viết tắt, Tên thành viên và Email.
  - **Phòng ban**: Hiển thị các tag phòng ban tham gia (nếu tham gia nhiều hơn 2 phòng ban, hiển thị tag rút gọn `+N` kèm tooltip danh sách chi tiết các phòng ban còn lại khi hover).
  - **Vai trò**: Badge chỉ vai trò (`admin`, `manager`, `employee`) với thiết kế màu sắc riêng biệt.
  - **Công việc**: Thanh tiến độ (Progress bar) biểu diễn tỷ lệ hoàn thành công việc kèm số liệu trực quan `[Số task hoàn thành] / [Tổng số task được giao]`.
  - **Trạng thái**: Nhãn chỉ trạng thái tài khoản (Hoạt động `active` kèm dot xanh lá, hoặc Ngưng hoạt động `inactive` kèm dot xám).
  - **Hành động (`⋮`)**: Menu thao tác nhanh.
- **Menu hành động nhanh (`⋮`)**:
  - **Xem chi tiết**: Mở slide Drawer chi tiết thông tin của thành viên.
  - **Chỉnh sửa**: Chỉ hiển thị đối với tài khoản là SuperAdmin (và ID thành viên khác 632). Cho phép chỉnh sửa thông tin vai trò, phòng ban của thành viên qua Edit Modal.
- **Phân trang (Pagination)**:
  - Nút phân trang chuyên dụng nằm ở cuối bảng.
  - Hỗ trợ đổi số bản ghi trên mỗi trang (10, 20, 50, 100 dòng) và tự động ghi nhớ cấu hình này vào `localStorage` cho những lần truy cập sau.

### 8.2 Drawer chi tiết thành viên (Profile Drawer)

Kích hoạt mở slide-in từ cạnh phải màn hình khi click vào hàng thành viên hoặc chọn hành động "Xem chi tiết".

- **Thông tin cá nhân (Header & Profile)**:
  - Avatar đại diện lớn, Tên đầy đủ, Vai trò.
  - Chi tiết liên lạc: Email, Số điện thoại, và ngày bắt đầu tham gia hệ thống.
  - Nút Chỉnh sửa (chỉ hiển thị cho tài khoản SuperAdmin).
- **Khung thống kê số liệu công việc (Stats Grid)**:
  - **Tổng số task**: Tổng số công việc được giao.
  - **Task đang làm**: Số lượng công việc chưa ở trạng thái 'done'.
  - **Tỷ lệ hoàn thành**: Tỷ lệ phần trăm công việc đã hoàn thành.
  - **Task đã xong**: Số lượng công việc đã hoàn thành (`done`).
- **Nội dung Tab chi tiết**:
  - **Công việc (Tasks)**: Danh sách chi tiết các công việc hiển thị: màu chấm trạng thái, tiêu đề công việc, tên dự án đính kèm và hạn chót.
  - **Đánh giá (Evaluations)**: Danh sách kỳ đánh giá năng lực hiển thị: điểm số đánh giá, badge xếp loại (Xuất sắc ⭐, Tốt ✅, Khá 🔵, Trung bình 🟡, Yếu 🔴) cùng tên người chấm.

---

## 9. EVALUATIONS (Đánh giá hiệu suất)

Trang đánh giá năng lực làm việc của nhân viên theo từng kỳ dựa trên số lượng công việc được giao, tỷ lệ hoàn thành đúng hạn và nhận xét từ người quản lý.

### 9.1 Giao diện và Bộ lọc (Evaluations Page)

- **Phân quyền truy cập**:
  - **Manager / Admin**: Quản lý và thực hiện đánh giá cho toàn bộ nhân viên cấp dưới.
  - **Employee (Nhân viên)**: Chỉ xem được danh sách kết quả đánh giá của chính bản thân mình sau khi đã được công bố (Published), ở chế độ chỉ đọc (Read-only).
- **Đầu trang (Header)**:
  - Tiêu đề: "Đánh giá hiệu suất" kèm tên kỳ đang lọc ở phụ đề.
  - Nút **"+ Tạo kỳ đánh giá mới"** (chỉ hiển thị cho Manager/Admin) dùng để tự động quét dữ liệu task và tạo các bản ghi đánh giá cho kỳ được chọn.
- **Khung số liệu tổng hợp (Summary Cards)**:
  - **Nhân viên**: Tổng số nhân viên tham gia đánh giá.
  - **Đã công bố**: Số lượng đánh giá đã gửi chính thức cho nhân viên (màu xanh lá).
  - **Chưa đánh giá**: Số lượng đánh giá đang ở dạng bản nháp (màu vàng).
  - **Điểm trung bình**: Điểm đánh giá trung bình toàn hệ thống trong kỳ (màu tím).
- **Thanh công cụ (Toolbar)**:
  - Dropdown chọn kỳ đánh giá (ví dụ: `Tháng 5 năm 2026`).
  - Nút lọc nhanh theo trạng thái: **Tất cả**, **Bản nháp**, **Đã công bố**.
- **Bảng danh sách đánh giá (Table Columns)**:
  - **Nhân viên**: Avatar màu đại diện, Tên nhân viên và Tên phòng ban phụ trách.
  - **Số công việc hoàn thành**: Tỷ lệ số công việc đã hoàn thành trên tổng số công việc được giao (`completed_tasks / total_tasks`).
  - **Đúng hạn**: Tỷ lệ phần trăm hoàn thành công việc đúng hạn. Tự động tô màu trực quan: màu xanh lá (>= 80%), màu xanh dương (>= 60%), và màu đỏ (< 60%).
  - **Điểm gợi ý**: Điểm số trung bình do hệ thống tự động tính toán dựa trên tiến độ và hạn chót (từ 1 đến 10), tô màu tương ứng (>= 8 xanh lá, >= 6 xanh dương, >= 4 vàng, dưới 4 đỏ).
  - **Xếp loại**: Xếp loại tự động dựa trên điểm số:
    - Điểm từ 9 - 10: ⭐ Xuất sắc (Excellent)
    - Điểm từ 7 - 8.9: ✅ Tốt (Good)
    - Điểm từ 5 - 6.9: 🔵 Khá (Fair)
    - Điểm từ 3 - 4.9: 🟡 Trung bình (Average)
    - Điểm dưới 3: 🔴 Yếu (Poor)
  - **Trạng thái**: Nhãn trạng thái Bản nháp (`draft`) hoặc Đã gửi (`published`).
  - Nút **"Xem chi tiết →"** để mở Drawer chi tiết đánh giá.
- **Tải thêm dữ liệu (Infinite Scroll)**:
  - Danh sách sử dụng Intersection Observer để phát hiện cuộn chuột xuống đáy trang và tự động tải thêm dữ liệu (phân trang 10 dòng/trang). Hiển thị spinner và dòng chữ `Đang tải thêm...` khi đang tải.

### 9.2 Drawer chi tiết đánh giá (Evaluation Detail Drawer)

Mở dạng slide-in từ cạnh phải màn hình khi click vào hàng nhân viên hoặc chọn "Xem chi tiết".

- **Thông tin thống kê công việc (Task Summary)**:
  - Hiển thị 4 thẻ số liệu: Tổng số task, Đã hoàn thành, Đúng hạn, Chưa hoàn thành.
  - Bảng danh sách công việc trong kỳ: Tiêu đề công việc, Hạn chót, Ngày hoàn thành, Trạng thái (hiển thị chấm tròn xanh lá đối với task đúng hạn, chấm tròn đỏ đối với task trễ hạn).
- **Kết quả đánh giá**: Điểm số gợi ý kèm badge nhãn xếp loại màu sắc tương ứng.
- **Nhận xét của Manager**:
  - Nếu trạng thái là bản nháp (**Draft**): Hiển thị ô nhập nhận xét (Textarea) cho phép Manager viết nội dung đánh giá chi tiết.
  - Nếu trạng thái đã công bố (**Published**): Hiển thị text tĩnh (Read-only), không cho phép chỉnh sửa.
- **Nút hành động (Footer)** (Chỉ hiển thị cho Manager/Admin khi ở trạng thái Draft):
  - Nút **Lưu nháp**: Lưu nhận xét tạm thời.
  - Nút **Công bố (Publish)**: Gửi chính thức kết quả đánh giá cho nhân viên, khóa chỉnh sửa và gửi thông báo in-app cho nhân viên đó.

---

## 10. ANALYTICS / REPORTS (Báo cáo & Phân tích)

Trang phân tích số liệu công việc và đánh giá hiệu suất hoạt động của toàn dự án hoặc từng cá nhân.

### 10.1 Bộ lọc và Xuất dữ liệu (Toolbar)

- **Bộ lọc dự án**: Dropdown cho phép lọc hiển thị số liệu theo một Dự án (Project) cụ thể hoặc xem tổng quan từ tất cả các dự án (`All projects`).
- **Xuất báo cáo (Export CSV)**: Nút xuất báo cáo ra file CSV (UTF-8 có BOM giúp không lỗi font chữ tiếng Việt trên Microsoft Excel). File CSV kết xuất chứa đầy đủ số liệu tổng quan công việc theo trạng thái, theo mức độ ưu tiên, khối lượng chưa hoàn thành của từng thành viên và bảng hiệu suất chi tiết của đội ngũ.

### 10.2 Hệ thống Biểu đồ Phân tích (Charts)

- **Tổng quan công việc (Donut Chart)**: Biểu đồ hình tròn khuyết hiển thị tỷ lệ phần trăm số lượng công việc theo các trạng thái (Done, In Progress, Review, Todo, Overdue).
- **Mức độ ưu tiên (Priority Bar Chart)**: Biểu đồ cột đứng biểu diễn số lượng công việc theo các mức độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp, Không ưu tiên).
- **Xu hướng hoàn thành (Line Chart)**: Biểu đồ đường so sánh tương quan số lượng công việc được tạo mới và số lượng công việc hoàn thành theo các tuần gần đây.
- **Khối lượng công việc (Horizontal Bar Chart)**: Biểu đồ cột ngang hiển thị số lượng công việc chưa hoàn thành hiện tại của từng thành viên.
- **Vòng tròn tiến độ hoàn thành (Progress Circle)**: Thể hiện trực quan tỷ lệ % công việc đã hoàn thành trên tổng số công việc kèm danh sách số lượng chi tiết cho từng trạng thái.

### 10.3 Hiệu suất đội ngũ (Team Performance Table)

- Bảng hiển thị thông tin thành viên (Avatar + Tên) kèm các chỉ số:
  - Tổng số công việc được giao.
  - Số công việc đã hoàn thành.
  - Tỷ lệ hoàn thành đúng hạn (%) (Tô màu tự động: màu xanh lá >= 80%, màu vàng >= 60%, màu đỏ < 60%).
  - Thời gian xử lý trung bình.

---

## 11. SETTINGS (Cài đặt hệ thống)

Trang quản lý cấu hình cá nhân và thiết lập chung của hệ thống. Hỗ trợ chuyển đổi nhanh qua Sidebar điều hướng trái và lưu cấu hình đồng bộ xuống DB qua API cũng như lưu cục bộ.

### 11.1 Các nội dung cấu hình (Tabs)

- **Thông báo (Notifications)**: Cho phép bật/tắt các công tắc (Toggle switches) nhận thông báo in-app hoặc email đối với 5 loại sự kiện chính:
  - Khi được giao công việc mới (`taskAssigned`).
  - Khi có bình luận mới trong công việc (`taskComment`).
  - Khi công việc sắp đến hạn chót (`deadline`).
  - Khi kết quả đánh giá hiệu suất được công bố (`evaluation`).
  - Khi dự án có cập nhật mới (`projectUpdate`).
- **Giao diện (Appearance)**: Lựa chọn 3 chủ đề hiển thị hệ thống:
  - **Sáng (Light)** ☀️.
  - **Tối (Dark)** 🌙.
  - **Hệ thống (System)** 💻.
  - *Thay đổi được áp dụng ngay lập tức lên toàn bộ giao diện mà không cần tải lại trang.*
- **Không gian làm việc (Workspace)**:
  - Thay đổi **Tên không gian làm việc** (Workspace Name).
  - Chọn **Múi giờ** hiển thị hệ thống (Asia/Ho_Chi_Minh, America/New_York, Europe/London,...).
  - Chọn **Ngôn ngữ hiển thị** chính của hệ thống (Tiếng Việt `vi`, English `en`, 日本語 `ja`).

---

## 12. GLOBAL SEARCH

- Nhấn **Search bar** ở header hoặc phím tắt `Cmd+K`
- Tìm kiếm: Tasks / Projects / Members / Comments
- Gợi ý realtime khi gõ
- Kết quả nhóm theo loại
- Click kết quả → navigate đến màn hình

---

## 13. PHÍM TẮT (Keyboard Shortcuts)

| Phím     | Hành động       |
| --------- | ------------------ |
| `Cmd+K` | Mở global search  |
| `Esc`   | Đóng modal/panel |
