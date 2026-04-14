# Operation Manual

## 1. Khởi tạo ban đầu

1. Chạy hệ thống:
   - `docker compose up --build`
2. Kiểm tra service:
   - Frontend: `http://localhost:3001`
   - Backend: `http://localhost:4000/api/v1/health`
   - Swagger: `http://localhost:4000/api/docs`
3. Nếu chạy local không dùng Docker:
   - `cd backend && npm run prisma:generate && npm run prisma:migrate:dev && npm run db:seed && npm run start:dev`
   - `cd frontend && npm install && npm run dev`
4. Nếu vừa cập nhật tính năng in tem mới, cần chạy migration trước khi sử dụng:
   - `cd backend && npm run prisma:migrate:dev`
5. Tài khoản demo:
   - `admin / 123456`
   - `manager1 / 123456`
   - `staff1 / 123456`
   - `staff2 / 123456`

## 2. Cấu hình ban đầu cho ADMIN

1. Đăng nhập `admin`
2. Kiểm tra store seed ở `Admin > Stores`
3. Vào `Admin > Users` để tạo manager/staff mới
4. Nếu cần thao tác chuyển kho, cấp permission `Chuyển kho` cho đúng user ở `Admin > Users`
5. Vào `Admin > Ingredients` để thêm nguyên liệu
6. Với mỗi nguyên liệu, khai báo đầy đủ:
   - mã nguyên liệu
   - tên nguyên liệu
   - đơn vị
   - nhóm nguyên liệu
7. Vào `Admin > Batches` để tạo lô hàng
8. Nếu cần, bấm `Tạo QR` để làm mới QR nền của lô
9. Bấm `In tem` để mở màn in tem của lô
10. Nhập `Số tem muốn in`
11. Nếu cần, chỉnh `Số cột mỗi trang` và `Số hàng mỗi trang`
12. Bấm `Tạo tem và mở in`
13. In tem từ browser và dán lên bao/thùng/hộp nguyên liệu
14. Vào `Admin > Whitelists` để cấu hình IP/SSID whitelist
15. Vào `Admin > Recipes` để:
   - tạo POS product
   - tạo recipe mapping
   - import POS sales mẫu
16. Vào `Control > Kho nguyên liệu` để cấu hình bố cục ban đầu theo:
   - chi nhánh
   - phạm vi `Sử dụng tại quán / Chuyển kho`
   - nhóm nguyên liệu
   - thứ tự nguyên liệu trong từng nhóm
17. Vào `Admin > Config` để chỉnh:
   - `allowFifoBypass`
   - `anomalyThreshold`

## 3. Quy tắc in tem lô hàng

1. Mỗi tem tương ứng với 1 `Number` của lô.
2. `Number` chạy liên tục theo từng lô, không reset mỗi lần in.
3. Ví dụ lô `Milk` có dải `1-50`:
   - lần 1 in `10` tem sẽ ra `1-10`
   - lần 2 in tiếp `10` tem sẽ ra `11-20`
4. Mỗi tem có một mã QR riêng, không trùng với tem khác trong cùng lô.
5. Hệ thống vẫn nhận được cả:
   - tem cũ có dạng `FNBBATCH:<batch_code>`
   - tem mới có QR riêng theo từng `Number`
6. Mặc định màn in dùng bố cục `2 cột x 5 hàng = 10 tem/trang`.
7. Có thể chỉnh số cột và số hàng ngay trên màn in để phù hợp khổ tem thực tế.
8. Nếu lô đã in hết toàn bộ dãy số hợp lệ, hệ thống sẽ không cấp thêm tem mới cho lô đó.

## 4. Vận hành hằng ngày cho STAFF

1. Đăng nhập
2. Nếu là first login, hệ thống bắt buộc đổi mật khẩu
3. Vào màn `Scan`
4. Quét QR trên tem nguyên liệu
5. Hệ thống tự nhận diện mã lô từ tem
6. Chọn phạm vi thao tác:
   - `Sử dụng tại quán`
   - `Chuyển kho` nếu tài khoản đã được cấp quyền
7. Nếu là `Chuyển kho`, chọn `chi nhánh nguồn` và `chi nhánh đích`
8. Nhập `Số lượng sử dụng` hoặc `Số lượng chuyển`
9. Bấm gửi lượt quét
10. Nếu camera lỗi, bật chế độ nhập tay và nhập `Mã lô`
11. Màu trạng thái:
   - xanh: scan thành công
   - vàng: warning FIFO
   - đỏ: scan bị reject
   - xám: đã lưu offline
12. Nếu mất mạng:
   - scan vẫn được lưu vào IndexedDB
   - badge hiển thị `OFFLINE`
   - khi có mạng lại, app tự sync
13. Nếu sync lỗi:
   - giữ thiết bị online
   - mở lại màn scan hoặc refresh
   - kiểm tra whitelist IP nếu bị reject liên tục

## 5. Vận hành hằng ngày cho MANAGER

1. Đăng nhập `manager1`
2. Vào `Dashboard`
3. Kiểm tra:
   - total scans
   - warning/error
   - fraud attempts
   - anomaly alerts
4. Xem `Reconciliation` để so expected vs actual
5. Nếu ratio đỏ:
   - kiểm tra camera scan
   - kiểm tra staff có scan đúng batch chưa
   - kiểm tra batch soft lock hoặc expired
6. Vào `Scan Logs` để xem chi tiết thao tác
7. Vào `Control > Kho nguyên liệu` để:
   - xem tồn theo nhóm nguyên liệu
   - kiểm tra số lượng đã quét theo ngày/ca
   - lọc nhanh theo `Loại nguyên liệu / Nguyên liệu`
   - lưu lại bố cục hiển thị nếu cần

## 6. Quản trị cho ADMIN

1. `Admin > Users`
   - tạo user
   - reset password
   - lock/unlock
   - cấp hoặc gỡ permission `Chuyển kho`
2. `Admin > Stores`
   - thêm/sửa/disable store
3. `Admin > Ingredients`
   - thêm/sửa/disable ingredient
   - quản lý đơn vị
   - khai báo nhóm nguyên liệu
4. `Admin > Batches`
   - tạo batch
   - soft lock/unlock
   - tạo QR
   - chọn số tem cần in
   - in tem theo dãy Number liên tục
5. `Admin > Batch Adjustments`
   - tăng/giảm tồn với lý do bắt buộc
6. `Admin > Recipes`
   - tạo POS product
   - tạo recipe
   - import POS sales
7. `Admin > Whitelists`
   - thêm/sửa/xóa IP/SSID whitelist
8. `Admin > Config`
   - chỉnh `allowFifoBypass`
   - chỉnh `anomalyThreshold`
9. `Admin > Audit Logs`
   - xem toàn bộ hành động quản trị

## 7. Sử dụng màn Kho nguyên liệu

1. Vào `Control > Kho nguyên liệu`
2. Bấm `Cấu hình` nếu cần đổi:
   - tháng
   - năm
   - chi nhánh
   - phạm vi `Sử dụng tại quán / Chuyển kho`
3. Dùng bộ lọc `Loại nguyên liệu` để thu gọn bảng theo một nhóm; khi chọn nhóm, màn hình sẽ hiện toàn bộ nguyên liệu thuộc nhóm đó
4. Dùng bộ lọc `Nguyên liệu` nếu cần tập trung vào một nguyên liệu cụ thể
5. Nếu có cảnh báo `tồn < 2`, bấm `Xem thêm` hoặc `Chỉ xem tồn thấp` để lọc nhanh các dòng cần chú ý
6. `ADMIN` và `MANAGER` có thể:
   - thêm nhóm vào bố cục
   - thêm nguyên liệu đúng nhóm
   - đổi thứ tự nhóm/nguyên liệu
   - lưu bố cục
7. `STAFF` chỉ xem, không được lưu bố cục
8. Bố cục được lưu riêng theo `chi nhánh + phạm vi sử dụng`
9. Trên laptop/desktop:
   - bảng hiển thị dạng ma trận ngày/ca
   - có thể lọc theo nhóm để giảm số cột phải theo dõi
10. Trên mobile:
   - danh sách nguyên liệu hiển thị dạng thẻ tóm tắt để thấy được nhiều nguyên liệu hơn
   - chạm vào từng nguyên liệu để bung chi tiết `ngày / ca`
   - có nút chuyển giữa `chỉ xem ngày có phát sinh` và `hiện đủ ngày`
11. Dữ liệu trên bảng tự cập nhật từ quét hợp lệ:
   - ô ngày/ca cộng đúng số lượng đã quét
   - `Số lượng tồn` là tổng tồn của tất cả lô còn lại cùng nguyên liệu trong chi nhánh đang chọn
12. Với phạm vi `Chuyển kho`, bảng hiển thị lượng xuất khỏi chi nhánh nguồn đang chọn

## 8. Kiểm thử luồng chính

1. Login `admin / 123456`
2. Login `staff2 / 123456` và xác nhận bị buộc đổi mật khẩu
3. Login `staff1 / 123456`, vào `Scan`
4. Scan `FNBBATCH:BATCH-TRA-001` với quantity nhỏ -> thành công
5. Scan `FNBBATCH:BATCH-TRA-002` khi `BATCH-TRA-001` còn tồn -> warning FIFO
6. Scan `BATCH-SUA-LOCK-001` bằng nhập tay -> lỗi soft lock
7. Scan `BATCH-DUONG-EXP-001` bằng nhập tay -> lỗi expired
8. Scan `BATCH-DUONG-DEP-001` bằng nhập tay -> lỗi depleted
9. Tắt mạng, scan batch bất kỳ -> lưu offline
10. Bật mạng lại -> queue tự sync
11. Vào `Admin > Batches`
12. Chọn một lô còn khả năng in tem, ví dụ `Milk`
13. Nhập số tem cần in là `10`
14. Mở màn `In tem`
15. Xác nhận màn hình hiển thị dãy `Number` tiếp theo của lô
16. Bấm `Tạo tem và mở in`
17. Kiểm tra `10` tem được render, mỗi tem có:
   - `Number` khác nhau
   - QR khác nhau
18. In lần tiếp theo cùng lô, xác nhận `Number` chạy tiếp, ví dụ `11-20`
19. Import POS sales ở `Admin > Recipes`
20. Chạy `Run anomaly detection` trên Dashboard
21. Vào `Batch Adjustments` tạo adjustment mẫu

## 9. Xử lý sự cố thường gặp

### Frontend không lên

- Kiểm tra `docker compose ps`
- Kiểm tra frontend container log
- Nếu chạy local: `cd frontend && npm run dev`

### Backend không kết nối DB

- Kiểm tra `DATABASE_URL`
- Kiểm tra PostgreSQL container đã healthy chưa
- Gọi `GET /api/v1/health/ready`

### Prisma migrate lỗi

- Chạy lại `cd backend && npm run prisma:generate`
- Sau đó `npm run prisma:migrate:dev`

### Tính năng in tem không cấp đúng Number

- Kiểm tra migration mới đã được chạy chưa
- Kiểm tra cột `printedLabelCount` đã có trong database chưa
- Nếu vừa deploy code mới nhưng chưa migrate, Number sẽ không hoạt động đúng

### Login không thành công vì account locked

- ADMIN vào `Admin > Users`
- Bấm `Unlock`

### First login bị kẹt

- User đổi mật khẩu xong nên đăng nhập lại nếu token cũ còn cache

### Scan bị reject vì whitelist

- Kiểm tra IP thực tế backend nhận được
- Thêm IP vào `Admin > Whitelists`
- Lưu ý SSID trên web browser chỉ là optional

### QR không đọc được

- Dùng chế độ nhập tay
- Kiểm tra tem in có bị nhòe hoặc quá nhỏ không
- Kiểm tra tem cũ có dạng `FNBBATCH:<batch_code>`
- Với tem mới, chỉ cần đảm bảo scanner đọc được QR, hệ thống sẽ tự tách ra mã lô

### Offline logs không sync

- Kiểm tra badge trạng thái có chuyển `SYNCING` không
- Giữ browser online
- Kiểm tra backend `/scan/sync`

### Duplicate client_event_id

- Đây là cơ chế chống trùng hợp lệ
- Không cần scan lại nếu event đã sync thành công

### Dashboard không có dữ liệu

- Kiểm tra đã có `PosSale`
- Kiểm tra đã có `ScanLog`
- Chạy `Run anomaly detection`

### Reconciliation sai

- Kiểm tra recipe mapping
- Kiểm tra business date
- Kiểm tra store scope

### Batch không trừ tồn

- Kiểm tra scan log có `SUCCESS/WARNING`
- Nếu `ERROR`, hệ thống chỉ ghi log chứ không trừ tồn

### Kho nguyên liệu không hiển thị đúng dữ liệu

- Kiểm tra đã chọn đúng `tháng / năm / chi nhánh / phạm vi`
- Kiểm tra nguyên liệu đã được khai báo `nhóm nguyên liệu` chưa
- Kiểm tra bố cục của `Kho nguyên liệu` đã thêm nhóm và nguyên liệu cần xem chưa
- Kiểm tra scan log có `SUCCESS/WARNING` trong đúng tháng đang lọc không
- Nếu đang lọc theo `Loại nguyên liệu / Nguyên liệu`, bấm `Xóa bộ lọc` để xem toàn bộ

### Chuyển kho quét không được

- Kiểm tra user đã được cấp permission `Chuyển kho` chưa
- Kiểm tra đã chọn đủ `chi nhánh nguồn` và `chi nhánh đích`
- Kiểm tra whitelist IP theo chi nhánh nguồn
- Kiểm tra lô nguồn còn đủ tồn để chuyển

## 10. Quy trình nghiệp vụ đề xuất

### Đầu ca

- Manager kiểm tra dashboard, anomaly alerts, batch soft lock
- Staff xác nhận camera scan và network badge ở trạng thái bình thường

### Trong ca

- Staff luôn scan batch trước khi xuất dùng
- Nếu camera lỗi thì dùng nhập tay, không bỏ qua hệ thống
- Nếu offline thì tiếp tục thao tác, đợi auto sync
- Nếu có điều chuyển nội bộ, dùng đúng chế độ `Chuyển kho`, không scan dưới chế độ sử dụng tại quán

### Khi nhập lô mới

- ADMIN tạo lô
- ADMIN in tem theo số lượng thực tế cần dán
- Nếu chưa cần dán hết toàn bộ lô, chỉ in một phần số tem
- Khi cần in thêm, hệ thống sẽ cấp tiếp `Number` còn lại của lô

### Cuối ca

- Manager xem warning/error/fraud attempts
- So reconciliation và kiểm tra ratio thấp
- Mở `Kho nguyên liệu` để rà nhanh các nhóm có tồn thấp hoặc phát sinh bất thường
- Nếu có hao hụt/đổ vỡ thì ADMIN tạo stock adjustment có lý do

## 11. Demo nhanh

1. Login `admin`
2. Tạo user staff mới
3. Đăng nhập user mới bằng temporary password
4. Đổi mật khẩu lần đầu
5. Tạo ingredient và batch mới
6. Mở `Admin > Batches`
7. Nhập số tem muốn in
8. Mở màn `In tem`
9. Tạo tem và in từ browser
10. Login `staff1`
11. Scan QR trên tem vừa in
12. Tắt mạng và scan offline
13. Bật mạng lại để auto sync
14. Import POS sales
15. Chạy anomaly detection
16. Tạo stock adjustment
17. Mở `Control > Kho nguyên liệu`
18. Kiểm tra bảng đã cộng đúng số lượng vào ngày/ca vừa quét
19. Mở dashboard để xem dữ liệu cập nhật
