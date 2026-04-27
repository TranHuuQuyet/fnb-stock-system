# Use Case Overview

## Current Product Surface

- `ADMIN` đăng nhập xong sẽ vào `Admin reports`.
- `MANAGER` và `STAFF` đăng nhập xong sẽ vào `Scan`.
- Web UI hiện tại không dùng `/dashboard` và `/admin/recipes` như màn vận hành chính; hai route này chỉ còn giữ để redirect tương thích.
- Quick scan trên web là luồng online-first. `scan/manual` và `scan/sync` vẫn còn ở API để hỗ trợ compatibility cũ, nhưng không còn là trải nghiệm chính của màn scan.

## Vai Trò

### `ADMIN`

- Quản lý cửa hàng, người dùng, nguyên liệu, batch, điều chỉnh tồn, whitelist và emergency bypass.
- In tem theo lô, theo dõi tồn kho tổng hợp, báo cáo admin và audit log.
- Lập và khóa/mở lại bảng chấm công tháng, chỉnh phụ cấp, đi trễ, về sớm và in bảng lương.
- Có thể quét sử dụng tại quán hoặc chuyển kho ở mọi chi nhánh.

### `MANAGER`

- Quét sử dụng tại quán ở chi nhánh của mình.
- Tạo phiếu chuyển kho theo role và xác nhận phiếu nhận của chi nhánh đích.
- Xem lịch sử quét, kho nguyên liệu và bảng chấm công của chi nhánh.
- Không sửa được bảng chấm công tháng, không vào được admin reports.

### `STAFF`

- Quét sử dụng tại quán ở chi nhánh của mình.
- Chỉ được chuyển kho nếu được cấp permission `scan_transfer`.
- Xem lịch sử quét, kho nguyên liệu, bảng chấm công và tài khoản của chính mình.

## Luồng Nghiệp Vụ Chính

### 1. Bootstrap vận hành

1. `ADMIN` tạo store active.
2. `ADMIN` tạo tài khoản `MANAGER/STAFF` với temporary password.
3. User đăng nhập lần đầu và bị buộc đổi mật khẩu.
4. `ADMIN` cấu hình whitelist IP hoặc emergency bypass theo từng chi nhánh.

### 2. Chuẩn bị hàng hóa

1. `ADMIN` tạo ingredient unit, ingredient group và ingredient.
2. `ADMIN` tạo batch cho chi nhánh.
3. `ADMIN` phát hành tem qua màn in mới.
4. Mỗi tem được cấp `Number` tuần tự và QR riêng theo `BATCH + SEQ`.

### 3. Sử dụng tại quán

1. `STAFF/MANAGER` mở màn `Scan`.
2. Hệ thống kiểm tra trạng thái mạng hiện tại của chi nhánh.
3. User quét tem đã phát hành.
4. Backend trừ ngay `1 đơn vị`, ghi `ScanLog`, chặn tem đã dùng lại và cảnh báo FIFO nếu cần.
5. Màn hình phản hồi ngay bằng badge, thông báo và âm báo thành công.

### 4. Chuyển kho giữa chi nhánh

1. `ADMIN/MANAGER` hoặc `STAFF` có permission `scan_transfer` chuyển sang mode `Chuyển kho`.
2. User chọn chi nhánh gửi và nhận rồi quét batch.
3. Hệ thống trừ tồn ở chi nhánh gửi và tạo `StockTransfer` trạng thái `IN_TRANSIT`.
4. Chi nhánh nhận mở `Scan logs` để xác nhận thực nhận.
5. Chỉ sau khi xác nhận, tồn mới được cộng vào batch đích.

### 5. Quan sát kho nguyên liệu

1. User mở `Ingredient stock`.
2. Hệ thống gom `ScanLog` hợp lệ theo `ngày / ca / operationType`.
3. Màn hình hỗ trợ lọc theo loại nguyên liệu, nguyên liệu, ngày và tồn thấp.
4. `ADMIN/MANAGER` có thể lưu bố cục hiển thị theo từng chi nhánh và loại nghiệp vụ.

### 6. Bảng chấm công và bảng lương

1. `ADMIN` mở `Work schedules` theo `store + year + month`.
2. Nếu chưa có dữ liệu, hệ thống dựng sẵn `Ca 1 / Ca 2 / Ca 3` và danh sách nhân sự active.
3. `ADMIN` phân ca, nhập đơn giá, phụ cấp, đi trễ, về sớm rồi lưu tháng.
4. UI hỗ trợ in bảng chấm công, in bảng lương, xuất CSV và Excel.
5. `MANAGER/STAFF` chỉ xem dữ liệu đã lưu.

### 7. Báo cáo quản trị

1. `ADMIN` mở `Admin reports`.
2. Hệ thống trả snapshot tồn kho hiện tại, hao hụt, lịch sử batch, top nguyên liệu dùng nhiều và tổng hợp lương tháng.
3. `ADMIN` có thể xuất Excel để gửi cho chủ/quản lý vận hành/kế toán.

### 8. Quản trị vòng đời user/store

1. `ADMIN` có thể lock/unlock/reset password user.
2. `DELETE /admin/users/:id` và `DELETE /admin/stores/:id` là soft delete, yêu cầu nhập lại mật khẩu admin.
3. Dữ liệu lịch sử không bị xóa khỏi hệ thống.

## Ghi Chú Hiện Trạng

- `dashboard`, `recipes`, `pos`, `anomalies` vẫn còn ở backend nhưng không còn là bề mặt web chính.
- `Scan logs` và `Ingredient stock` là hai màn vận hành thay thế phần lớn nhu cầu dashboard cũ ở phía web.
- IndexedDB sync layer vẫn còn để dọn backlog legacy, nhưng quick-scan web hiện tại không tạo queue mới khi thiết bị offline.
