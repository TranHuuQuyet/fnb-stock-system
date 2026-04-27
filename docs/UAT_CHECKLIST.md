# UAT Checklist

Tài liệu này dùng để kiểm thử chấp nhận người dùng trước khi mở hệ thống cho 2 chi nhánh sử dụng thực tế. Thứ tự khuyến nghị là:

1. Dựng staging theo [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
2. Chạy toàn bộ checklist UAT trong tài liệu này
3. Chỉ go-live sau khi đã chốt lại các lỗi còn lại và hoàn thành [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)

Trạng thái rollout mới nhất nên được ghi song song tại [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md).

## 1. Mục tiêu UAT

- Xác nhận các luồng kho và nhân sự đang chạy đúng như nghiệp vụ đã chốt
- Xác nhận phân quyền `ADMIN / MANAGER / STAFF` đúng với phạm vi thao tác thực tế
- Xác nhận hệ thống đủ ổn định để pilot ở 2 chi nhánh đầu tiên

## 2. Điều kiện trước khi test

1. Đã deploy staging và chạy migrate mới nhất
2. Nếu môi trường mới vừa bootstrap admin, tài khoản đó đã đăng nhập và đổi mật khẩu lần đầu
3. Đã có ít nhất 2 chi nhánh test, ví dụ `CN01` và `CN02`
4. Đã tạo sẵn user test:
   - `ADMIN`
   - `MANAGER` cho mỗi chi nhánh
   - `STAFF` cho mỗi chi nhánh
5. Đã có tối thiểu:
   - 3 nguyên liệu
   - 2 nhóm nguyên liệu
   - 1 đơn vị nguyên liệu
   - 3 batch còn hạn dùng
6. Đã có ít nhất 2 thiết bị thật để test scan và chuyển kho giữa 2 chi nhánh
7. Đã cấu hình `IP whitelist` cho mạng test của từng chi nhánh

## 3. Tiêu chí pass/fail

- `Pass`: kết quả đúng nghiệp vụ, không cần workaround
- `Conditional pass`: chấp nhận được trong pilot nhưng phải ghi rõ workaround
- `Fail`: sai số liệu, sai phân quyền, mất dữ liệu, không hoàn thành được nghiệp vụ

Không nên go-live nếu còn lỗi `Fail` ở các nhóm sau:

- đăng nhập và phân quyền
- scan sử dụng tại quán
- chuyển kho 2 chiều
- ca làm và bảng lương
- backup hoặc restore test

## 4. Bộ test bắt buộc

### 4.1 Đăng nhập và phân quyền

1. Đăng nhập bằng `ADMIN` từ mạng bất kỳ
   - Kỳ vọng: đăng nhập thành công
2. Đăng nhập bằng `MANAGER` hoặc `STAFF` khi đang ở đúng mạng quán
   - Kỳ vọng: đăng nhập thành công
3. Đăng nhập bằng `MANAGER` hoặc `STAFF` từ mạng không nằm trong whitelist
   - Kỳ vọng: bị chặn hoặc phải dùng `Emergency bypass`
4. Đăng nhập bằng tài khoản first-login
   - Kỳ vọng: bị bắt buộc đổi mật khẩu
5. Thử nhập sai mật khẩu nhiều lần
   - Kỳ vọng: có ghi nhận log đăng nhập thất bại
6. Kiểm tra quyền theo role:
   - `ADMIN`: truy cập toàn bộ màn hình
   - `MANAGER`: xem lịch sử quét, kho nguyên liệu, quản lý ca làm, tạo và xác nhận chuyển kho
   - `STAFF`: scan sử dụng tại quán; chỉ chuyển kho nếu được cấp permission `Chuyển kho`

### 4.2 Cấu hình ban đầu

1. `ADMIN` tạo store, user, ingredient unit, ingredient group, ingredient
2. Cấu hình `IP whitelist` cho từng chi nhánh
3. Bật `Emergency bypass` có thời hạn cho một chi nhánh
   - Kỳ vọng: chỉ `ADMIN` bật được
4. Tắt `Emergency bypass`
   - Kỳ vọng: policy mạng quay về trạng thái bình thường

### 4.3 Batch và in tem

1. Tạo batch mới
2. In tem lần đầu
   - Kỳ vọng: `Number` tăng tuần tự
3. In thêm tem cho cùng batch
   - Kỳ vọng: không reset lại `Number`
4. In lại tem
   - Kỳ vọng: phải nhập lý do và có audit log
5. Quét tem cũ và tem mới
   - Kỳ vọng: hệ thống đều nhận được `batchCode`

### 4.4 Scan sử dụng tại quán

1. `STAFF` quét batch ở chế độ `Sử dụng tại quán`
   - Kỳ vọng: tạo scan log thành công và trừ tồn đúng
2. Quét batch gần hết hạn hoặc không đúng FIFO
   - Kỳ vọng: có cảnh báo theo config
3. Quét batch đã soft lock hoặc hết hạn
   - Kỳ vọng: bị reject đúng rule
4. Tắt mạng trên thiết bị rồi scan ở chế độ `Sử dụng tại quán`
   - Kỳ vọng: UI chặn quick scan và báo cần online đúng mạng chi nhánh
5. Nếu còn client legacy dùng `scan/sync`, bật mạng lại
   - Kỳ vọng: event sync thành công, không tạo bản ghi trùng

### 4.5 Chuyển kho 2 chiều

1. `MANAGER` ở chi nhánh A tạo lượt `Chuyển kho` sang chi nhánh B
   - Kỳ vọng: tồn kho A giảm, phiếu chuyển có trạng thái `IN_TRANSIT`
2. Kiểm tra chi nhánh B trước khi xác nhận
   - Kỳ vọng: hàng chưa được cộng vào kho B
3. `MANAGER` hoặc `ADMIN` ở chi nhánh B xác nhận nhận đủ hàng
   - Kỳ vọng: kho B tăng đúng số lượng, phiếu chuyển sang `RECEIVED`
4. Tạo thêm 1 phiếu chuyển và xác nhận nhận thiếu
   - Kỳ vọng: nhập được `Số lượng nhận`, bắt buộc ghi chú lý do chênh lệch
5. Tắt mạng rồi thử `Chuyển kho`
   - Kỳ vọng: hệ thống không cho thao tác offline

### 4.6 Kho nguyên liệu

1. Mở `Control > Kho nguyên liệu` tại chi nhánh A
2. Kiểm tra sau scan sử dụng tại quán
   - Kỳ vọng: số liệu cập nhật đúng theo ngày, ca, phạm vi
3. Kiểm tra sau chuyển kho
   - Kỳ vọng: chi nhánh nguồn giảm ngay khi gửi, chi nhánh đích chỉ tăng sau khi xác nhận
4. Kiểm tra bộ lọc nhóm nguyên liệu và nguyên liệu
   - Kỳ vọng: không làm sai tổng số liệu

### 4.7 Ca làm việc và bảng lương

1. `ADMIN` hoặc `MANAGER` tạo bảng chấm công tháng hiện tại
2. Nhập ca 1, ca 2, ca 3 cho ít nhất 2 nhân viên
3. Nhập `giờ thử việc`, `giờ chính thức`, `phụ cấp`, `đi trễ`, `về sớm`
4. Kiểm tra tổng lương
   - Kỳ vọng: `lương gốc + phụ cấp - khấu trừ = thực nhận`
5. Dùng `In bảng lương`
   - Kỳ vọng: mở được bản in
6. Dùng `Xuất Excel`
   - Kỳ vọng: file mở được bằng Excel
7. Chuyển trạng thái sang `LOCKED`
   - Kỳ vọng: user thường không sửa tiếp được
8. `ADMIN` mở lại tháng bằng cách chuyển về `DRAFT` hoặc `PUBLISHED`
   - Kỳ vọng: chỉnh sửa lại được

### 4.8 Báo cáo admin

1. Mở `Admin > Reports`
2. Kiểm tra các khối dữ liệu:
   - tồn kho hiện tại
   - hao hụt
   - lịch sử batch
   - top nguyên liệu dùng nhiều
   - tổng hợp bảng lương
3. Đối chiếu nhanh với dữ liệu nguồn
   - Kỳ vọng: số liệu không lệch rõ ràng so với `Batch`, `Scan Log`, `Work Schedule`

### 4.9 Backup và restore thử

1. Tạo 1 bản backup mới
2. Restore vào database test riêng
3. Mở hệ thống trên môi trường test-restore
4. Kiểm tra tối thiểu:
   - đăng nhập admin
   - danh sách user
   - batch
   - scan logs
   - work schedules

## 5. Biên bản kết quả

Điền kết quả sau mỗi vòng UAT:

| Nhóm test | Kết quả | Ghi chú |
| --- | --- | --- |
| Đăng nhập và phân quyền | Pass / Conditional pass / Fail | |
| Cấu hình ban đầu | Pass / Conditional pass / Fail | |
| Batch và in tem | Pass / Conditional pass / Fail | |
| Scan sử dụng tại quán | Pass / Conditional pass / Fail | |
| Chuyển kho 2 chiều | Pass / Conditional pass / Fail | |
| Kho nguyên liệu | Pass / Conditional pass / Fail | |
| Ca làm và bảng lương | Pass / Conditional pass / Fail | |
| Báo cáo admin | Pass / Conditional pass / Fail | |
| Backup và restore thử | Pass / Conditional pass / Fail | |

## 6. Điều kiện chuyển sang go-live

Chỉ nên chuyển sang bước go-live khi:

1. Không còn lỗi `Fail` ở các nhóm test bắt buộc
2. Các lỗi `Conditional pass` đều đã có workaround rõ ràng
3. Người vận hành đã được hướng dẫn theo [OPERATION_MANUAL.md](./OPERATION_MANUAL.md)
4. Đã chốt ngày pilot hoặc ngày go-live cụ thể
5. `DEPLOYMENT_STATUS.md` đã được cập nhật đúng trạng thái hiện tại trước khi chuyển sang go-live
