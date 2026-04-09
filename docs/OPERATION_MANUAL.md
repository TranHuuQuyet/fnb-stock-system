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
4. Tài khoản demo:
   - `admin / 123456`
   - `manager1 / 123456`
   - `staff1 / 123456`
   - `staff2 / 123456`

## 2. Cấu hình ban đầu cho ADMIN

1. Đăng nhập `admin`
2. Kiểm tra store seed ở `Admin > Stores`
3. Vào `Admin > Users` để tạo manager/staff mới
4. Vào `Admin > Ingredients` để thêm nguyên liệu
5. Vào `Admin > Batches` để tạo batch
6. Bấm `Generate QR`, sau đó mở `Print label`
7. In tem từ browser và dán lên bao/thùng/hộp nguyên liệu
8. Vào `Admin > Whitelists` để cấu hình IP/SSID whitelist
9. Vào `Admin > Recipes` để:
   - tạo POS product
   - tạo recipe mapping
   - import POS sales mẫu
10. Vào `Admin > Config` để chỉnh:
   - `allowFifoBypass`
   - `anomalyThreshold`

## 3. Vận hành hằng ngày cho STAFF

1. Đăng nhập
2. Nếu là first login, hệ thống bắt buộc đổi mật khẩu
3. Vào màn `Scan`
4. Quét QR trên tem nguyên liệu
5. Nhập `quantity used`
6. Nếu camera lỗi, bật `Manual fallback` và nhập `batch code`
7. Màu trạng thái:
   - xanh: scan thành công
   - vàng: warning FIFO
   - đỏ: scan bị reject
   - xám: đã lưu offline
8. Nếu mất mạng:
   - scan vẫn được lưu vào IndexedDB
   - badge hiển thị `OFFLINE`
   - khi có mạng lại, app tự sync
9. Nếu sync lỗi:
   - giữ thiết bị online
   - mở lại màn scan hoặc refresh
   - kiểm tra whitelist IP nếu bị reject liên tục

## 4. Vận hành hằng ngày cho MANAGER

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

## 5. Quản trị cho ADMIN

1. `Admin > Users`
   - tạo user
   - reset password
   - lock/unlock
2. `Admin > Stores`
   - thêm/sửa/disable store
3. `Admin > Ingredients`
   - thêm/sửa/disable ingredient
4. `Admin > Batches`
   - tạo batch
   - soft lock/unlock
   - generate QR
   - print label
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

## 6. Kiểm thử luồng chính

1. Login `admin / 123456`
2. Login `staff2 / 123456` và xác nhận bị buộc đổi mật khẩu
3. Login `staff1 / 123456`, vào `Scan`
4. Scan `FNBBATCH:BATCH-TRA-001` với quantity nhỏ -> thành công
5. Scan `FNBBATCH:BATCH-TRA-002` khi `BATCH-TRA-001` còn tồn -> warning FIFO
6. Scan `BATCH-SUA-LOCK-001` -> lỗi soft lock
7. Scan `BATCH-DUONG-EXP-001` -> lỗi expired
8. Scan `BATCH-DUONG-DEP-001` -> lỗi depleted
9. Tắt mạng, scan batch bất kỳ -> lưu offline
10. Bật mạng lại -> queue tự sync
11. Import POS sales ở `Admin > Recipes`
12. Chạy `Run anomaly detection` trên Dashboard
13. Vào `Batch Adjustments` tạo adjustment mẫu
14. Mở label preview và in từ browser

## 7. Xử lý sự cố thường gặp

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

- Dùng `Manual fallback`
- Kiểm tra tem in có đúng format `FNBBATCH:<batch_code>`

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

## 8. Quy trình nghiệp vụ đề xuất

### Đầu ca

- Manager kiểm tra dashboard, anomaly alerts, batch soft lock
- Staff xác nhận camera scan và network badge ở trạng thái bình thường

### Trong ca

- Staff luôn scan batch trước khi xuất dùng
- Nếu camera lỗi thì dùng manual fallback, không bỏ qua hệ thống
- Nếu offline thì tiếp tục thao tác, đợi auto sync

### Cuối ca

- Manager xem warning/error/fraud attempts
- So reconciliation và kiểm tra ratio thấp
- Nếu có hao hụt/đổ vỡ thì ADMIN tạo stock adjustment có lý do

## 9. Demo nhanh

1. Login `admin`
2. Tạo user staff mới
3. Đăng nhập user mới bằng temporary password
4. Đổi mật khẩu lần đầu
5. Tạo ingredient và batch mới
6. Generate QR
7. In tem bằng browser
8. Login `staff1`
9. Scan QR batch
10. Tắt mạng và scan offline
11. Bật mạng lại để auto sync
12. Import POS sales
13. Chạy anomaly detection
14. Tạo stock adjustment
15. Mở dashboard để xem dữ liệu cập nhật
