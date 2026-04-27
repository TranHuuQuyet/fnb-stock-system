# Operation Manual

Tài liệu này tập trung vào thao tác local/demo và kiểm thử nghiệp vụ hằng ngày trong môi trường phát triển. Đây không phải runbook production trên VPS. Nếu bạn đang vận hành staging/production, ưu tiên [VPS_OPERATIONS.md](./VPS_OPERATIONS.md), [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md), [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md), [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) và [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md).

## 1. Khởi tạo ban đầu cho local/demo

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
5. Tài khoản demo local:
   - `admin / 123456`
   - `manager1 / 123456`
   - `staff1 / 123456`
   - `staff2 / 123456`

## 2. Cấu hình ban đầu cho ADMIN

1. Đăng nhập `admin`
2. Kiểm tra store seed ở `Admin > Stores`
3. Vào `Admin > Users` để tạo manager/staff mới
4. `MANAGER` có thể chuyển kho theo role; nếu muốn cho `STAFF` chuyển kho, cấp permission `Chuyển kho` ở `Admin > Users`
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
14. Vào `Admin > Whitelists` để cấu hình `IP whitelist` cho từng chi nhánh
15. Nếu mạng chi nhánh đổi đột xuất, dùng `Emergency bypass` có thời hạn ở cùng màn hình để mở tạm nghiệp vụ
16. Vào `Admin > Recipes` để:
   - tạo POS product
   - tạo recipe mapping
   - import POS sales mẫu
17. Vào `Control > Kho nguyên liệu` để cấu hình bố cục ban đầu theo:
   - chi nhánh
   - phạm vi `Sử dụng tại quán / Chuyển kho`
   - nhóm nguyên liệu
   - thứ tự nguyên liệu trong từng nhóm
18. Vào `Control > Ca làm việc` để khởi tạo bảng chấm công tháng nếu cần sắp ca và theo dõi giờ công
19. Vào `Admin > Config` để chỉnh:
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
   - `Chuyển kho` nếu là `MANAGER` hoặc `STAFF` đã được cấp quyền
7. Nếu là `Chuyển kho`, chọn `chi nhánh nguồn` và `chi nhánh đích`
8. Quick scan hiện tại luôn xử lý `1 đơn vị` cho mỗi lần quét; muốn dùng/chuyển nhiều thì quét nhiều lần
9. Không cần nút gửi; QR hợp lệ sẽ tự xử lý ngay
10. Nếu là `Chuyển kho`, hệ thống sẽ tạo `phiếu chuyển kho`, trừ tồn ở chi nhánh gửi và chờ chi nhánh nhận xác nhận
11. Nếu camera lỗi, kiểm tra quyền camera/trình duyệt hoặc đổi thiết bị; nhập tay hiện chỉ còn là luồng API legacy
12. Màu trạng thái:
   - xanh: scan thành công
   - vàng: warning FIFO
   - đỏ: scan bị reject
   - xám: trạng thái sync legacy trên client cũ (nếu còn dùng)
13. Nếu mất mạng:
   - quick scan web hiện tại sẽ bị chặn
   - `Chuyển kho` vẫn không cho thao tác offline
   - badge hiển thị `OFFLINE`
   - chỉ các client legacy còn backlog IndexedDB mới cần chờ `scan/sync`
14. Nếu sync lỗi:
   - giữ thiết bị online
   - mở lại màn scan hoặc refresh nếu đang xử lý backlog legacy
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
7. Nếu có phiếu chuyển kho đang đến chi nhánh mình, vào tab `Chuyển kho` để xác nhận số lượng thực nhận
8. Nếu nhận thiếu hoặc hỏng, nhập đúng `Số lượng nhận` và bắt buộc ghi chú lý do chênh lệch
9. Vào `Control > Kho nguyên liệu` để:
   - xem tồn theo nhóm nguyên liệu
   - kiểm tra số lượng đã quét theo ngày/ca
   - lọc nhanh theo `Loại nguyên liệu / Nguyên liệu`
   - lưu lại bố cục hiển thị nếu cần
10. Vào `Control > Ca làm việc` để xem bảng chấm công tháng, giờ thử việc/chính thức, phụ cấp, đi trễ/về sớm và in bảng lương nếu cần

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
   - thêm/xóa IP whitelist
   - dùng `Lấy IP hiện tại` để đọc IP mà backend thực sự nhận được
   - bật/tắt `Emergency bypass` có thời hạn khi mạng chi nhánh đổi đột xuất
8. `Admin > Config`
   - chỉnh `allowFifoBypass`
   - chỉnh `anomalyThreshold`
9. `Control > Ca làm việc`
   - tạo/chỉnh bảng chấm công theo tháng
   - cấu hình ca làm, đơn giá thử việc/chính thức, phụ cấp, đi trễ/về sớm
   - chuyển trạng thái `DRAFT / PUBLISHED / LOCKED`
   - in bảng chấm công, in bảng lương, xuất CSV, xuất Excel
10. `Admin > Reports`
   - xem tồn kho hiện tại
   - theo dõi hao hụt
   - xem lịch sử batch
   - xem top nguyên liệu dùng nhiều
   - xem tổng hợp bảng lương theo tháng
11. `Admin > Audit Logs`
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

## 8. Sử dụng màn Ca làm việc

1. Vào `Control > Ca làm việc`
2. Chọn `tháng / năm`; `ADMIN` có thể đổi chi nhánh, `MANAGER` và `STAFF` chỉ xem chi nhánh của tài khoản
3. Nếu tháng chưa có dữ liệu, hệ thống sẽ trả khung mặc định `Ca 1 / Ca 2 / Ca 3`
4. `ADMIN` có thể:
   - đổi tên bảng và ghi chú
   - thêm/sửa/xóa ca
   - đổi thứ tự ca
   - nhập đơn giá `thử việc / chính thức`
   - nhập `phụ cấp`, `đi trễ`, `về sớm` trong bảng lương tháng
   - chấm từng ngày/ca cho từng nhân viên
   - lưu bảng với trạng thái `DRAFT / PUBLISHED / LOCKED`
5. `MANAGER` và `STAFF` chỉ xem bảng hiện có, không được lưu hoặc chốt tháng
6. Có thể bấm `In bảng chấm công`, `In bảng lương`, `Xuất CSV`, `Xuất Excel` để in hoặc đối soát ngoài hệ thống
7. Nếu vừa thêm nhân viên mới trong chi nhánh, bấm `Tải lại` để lấy danh sách active mới nhất
8. Khi trạng thái là `LOCKED`, grid chấm công bị khóa; `ADMIN` có thể đổi lại trạng thái để mở khóa tạm thời nếu cần chỉnh sửa

## 9. Kiểm thử luồng chính

Phần này là checklist nhanh để tự kiểm tra trong quá trình dev hoặc demo. Khi chuẩn bị triển khai thực tế, dùng thêm [UAT_CHECKLIST.md](./UAT_CHECKLIST.md) để test đủ trước khi go-live.

1. Login `admin / 123456`
2. Login `staff2 / 123456` và xác nhận bị buộc đổi mật khẩu
3. Login `staff1 / 123456`, vào `Scan`
4. Scan tem đã phát hành của `BATCH-TRA-001` -> thành công
5. Scan tem của `BATCH-TRA-002` khi `BATCH-TRA-001` còn tồn -> warning FIFO
6. Nếu cần test luồng legacy, gọi `scan/manual` với `BATCH-SUA-LOCK-001` -> lỗi soft lock
7. Nếu cần test luồng legacy, gọi `scan/manual` với `BATCH-DUONG-EXP-001` -> lỗi expired
8. Nếu cần test luồng legacy, gọi `scan/manual` với `BATCH-DUONG-DEP-001` -> lỗi depleted
9. Tắt mạng, thử scan batch bất kỳ -> UI phải chặn quick scan
10. Bật mạng lại -> scan lại thành công; chỉ client legacy mới cần queue tự sync
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
22. Vào `Control > Ca làm việc`
23. Chọn tháng hiện tại, chỉnh thử một vài ca và đơn giá rồi lưu bằng `admin`
24. Nhập thử `phụ cấp`, `đi trễ`, `về sớm` cho ít nhất 1 nhân viên
25. Bấm `In bảng lương` hoặc `Xuất Excel`
26. Chuyển trạng thái sang `LOCKED` và xác nhận grid chấm công bị khóa
27. Chuyển lại trạng thái `PUBLISHED` để xác nhận admin có thể mở khóa tạm thời khi cần
28. Tạo một phiếu `Chuyển kho` từ chi nhánh A sang chi nhánh B
29. Đăng nhập `manager` hoặc `admin` của chi nhánh B, vào `Scan Logs > Chuyển kho`
30. Xác nhận số lượng nhận đủ hoặc nhận thiếu kèm ghi chú
31. Kiểm tra tồn kho chi nhánh B chỉ tăng sau bước xác nhận

## 10. Xử lý sự cố thường gặp

### Frontend không lên

- Kiểm tra `docker compose ps`
- Kiểm tra frontend container log
- Nếu chạy local: `cd frontend && npm run dev`

### Backend không kết nối DB

- Nếu chạy local/demo: kiểm tra `DATABASE_URL`
- Nếu chạy staging/production: xem `docs/VPS_OPERATIONS.md` và phân biệt `DATABASE_URL` cho runtime với `DIRECT_URL` cho migrate
- Kiểm tra PostgreSQL container đã healthy chưa
- Gọi `GET /api/v1/health/ready`

### Prisma migrate lỗi

- Nếu chạy local/dev: chạy lại `cd backend && npm run prisma:generate`
- Sau đó `npm run prisma:migrate:dev`
- Nếu chạy staging/production: không dùng `prisma:migrate:dev`; xem `docs/VPS_OPERATIONS.md` và ưu tiên kiểm tra `DIRECT_URL`

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
- Luồng web hiện tại ưu tiên `IP whitelist`; nếu mạng đổi đột xuất có thể bật `Emergency bypass` tạm thời

### QR không đọc được

- Thử lại bằng thiết bị/camera khác; nếu cần kiểm thử backend thì dùng route `scan/manual` legacy
- Kiểm tra tem in có bị nhòe hoặc quá nhỏ không
- Kiểm tra tem cũ có dạng `FNBBATCH:<batch_code>`
- Với tem mới, chỉ cần đảm bảo scanner đọc được QR, hệ thống sẽ tự tách ra mã lô

### Legacy sync backlog không đồng bộ

- Quick scan web hiện tại không tạo thêm event offline mới
- Nếu đơn vị còn client legacy, kiểm tra badge trạng thái có chuyển `SYNCING` không
- Giữ browser online
- Kiểm tra backend `/scan/sync`

### Duplicate client_event_id

- Đây là cơ chế chống trùng hợp lệ
- Không cần scan lại nếu event đã sync thành công

### Bảng chấm công không lưu được

- Kiểm tra đang đăng nhập bằng `ADMIN`
- Kiểm tra tháng đó có đang ở trạng thái `LOCKED` không; nếu có thì đổi lại `DRAFT` hoặc `PUBLISHED` để mở khóa tạm thời
- Kiểm tra danh sách ca không bị trùng `key`
- Kiểm tra ngày chấm công nằm trong đúng tháng đang chọn

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

- Kiểm tra user là `MANAGER` hoặc `STAFF` đã được cấp permission `Chuyển kho`
- Kiểm tra đã chọn đủ `chi nhánh nguồn` và `chi nhánh đích`
- Kiểm tra whitelist IP theo chi nhánh nguồn
- Kiểm tra lô nguồn còn đủ tồn để chuyển
- Kiểm tra thiết bị đang online vì chuyển kho không hỗ trợ offline

### Phiếu chuyển kho chưa vào tồn kho chi nhánh nhận

- Kiểm tra chi nhánh nhận đã vào `Scan Logs > Chuyển kho` để xác nhận chưa
- Kiểm tra phiếu còn ở trạng thái `IN_TRANSIT` hay đã `RECEIVED`
- Nếu nhận thiếu, bắt buộc nhập ghi chú khi xác nhận

## 11. Quy trình nghiệp vụ đề xuất

### Đầu ca

- Manager kiểm tra scan logs, phiếu chuyển kho đang chờ xác nhận, kho nguyên liệu và batch soft lock
- Staff xác nhận camera scan và network badge ở trạng thái bình thường

### Trong ca

- Staff luôn scan batch trước khi xuất dùng
- Nếu camera lỗi thì xử lý quyền camera/trình duyệt hoặc đổi thiết bị, không bỏ qua hệ thống
- Nếu offline thì dừng quick scan, kết nối lại đúng mạng chi nhánh rồi quét tiếp
- Nếu có điều chuyển nội bộ, dùng đúng chế độ `Chuyển kho`, không scan dưới chế độ sử dụng tại quán

### Khi nhập lô mới

- ADMIN tạo lô
- ADMIN in tem theo số lượng thực tế cần dán
- Nếu chưa cần dán hết toàn bộ lô, chỉ in một phần số tem
- Khi cần in thêm, hệ thống sẽ cấp tiếp `Number` còn lại của lô

### Cuối ca

- Manager xem warning/error/fraud attempts
- Mở `Kho nguyên liệu` để rà nhanh các nhóm có tồn thấp hoặc phát sinh bất thường
- Mở `Ca làm việc` để rà nhanh giờ công trong tháng nếu cần đối chiếu nhân sự
- Nếu cần tổng hợp tồn/lương, nhờ `ADMIN` mở `Admin reports`; chỉ kiểm tra POS/anomaly nếu đơn vị đang dùng tích hợp đó
- Nếu có hao hụt/đổ vỡ thì ADMIN tạo stock adjustment có lý do

## 12. Demo nhanh

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
12. Tắt mạng và xác nhận màn scan bị chặn
13. Bật mạng lại rồi scan lại thành công
14. Import POS sales
15. Chạy anomaly detection
16. Tạo stock adjustment
17. Mở `Control > Kho nguyên liệu`
18. Kiểm tra bảng đã cộng đúng số lượng vào ngày/ca vừa quét
19. Mở `Scan logs` và `Kho nguyên liệu` để xem dữ liệu cập nhật
20. Mở `Control > Ca làm việc`
21. Kiểm tra bảng chấm công tháng hiện tại, nhập thử `phụ cấp / đi trễ / về sớm`
22. Thử `In bảng lương` hoặc `Xuất Excel`
23. Nếu cần, chuyển trạng thái `LOCKED` rồi mở lại bằng `admin` để xác nhận cơ chế khóa tạm
