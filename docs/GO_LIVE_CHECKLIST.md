# Go-Live Checklist

Tài liệu này dùng cho ngày mở hệ thống thực tế tại `fnbstore.store`. Nên chạy theo đúng thứ tự để giảm rủi ro khi triển khai cho 2 chi nhánh đầu tiên.

## 1. Quyết định đã chốt

- Hệ thống dùng nội bộ cho chuỗi cửa hàng
- Giai đoạn đầu triển khai cho `2` chi nhánh
- Frontend và backend đi cùng 1 domain: `https://fnbstore.store`
- API production: `https://fnbstore.store/api/v1`
- Hạ tầng khuyến nghị: `1 VPS chạy app + PostgreSQL managed`
- Chuyển kho theo flow:
  - chi nhánh A gửi hàng
  - hàng vào trạng thái `IN_TRANSIT`
  - chi nhánh B xác nhận nhận
  - chỉ khi đó kho B mới tăng
- Offline chỉ áp dụng cho `Sử dụng tại quán`
- Chính sách backup:
  - `14` bản daily
  - `8` bản weekly
  - `3` bản monthly

## 2. Trước ngày go-live 3 đến 7 ngày

1. Hoàn thành [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
2. Hoàn thành [UAT_CHECKLIST.md](./UAT_CHECKLIST.md)
3. Chốt branch hoặc tag sẽ deploy production
4. Chốt danh sách user đầu tiên:
   - `ADMIN`
   - `MANAGER` từng chi nhánh
   - `STAFF` từng chi nhánh
5. Chốt danh mục ban đầu:
   - store
   - ingredient unit
   - ingredient group
   - ingredient
6. Chuẩn bị danh sách IP whitelist của từng chi nhánh
7. In thử tem trên khổ giấy hoặc máy in thực tế
8. Kiểm tra thiết bị dùng để scan ở 2 chi nhánh
9. Chuẩn bị hướng dẫn vận hành ngắn cho quản lý và nhân viên

## 3. Trước giờ go-live

1. Xác nhận backup production đang hoạt động
2. Chạy thêm 1 bản backup thủ công trước deploy
3. Kiểm tra dung lượng đĩa và trạng thái database
4. Kiểm tra domain `fnbstore.store` và chứng chỉ TLS
5. Kiểm tra env production:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN=https://fnbstore.store`
   - `NEXT_PUBLIC_API_BASE_URL=https://fnbstore.store/api/v1`
6. Xác nhận production không chạy `db:seed`
7. Xác nhận đã có lệnh `bootstrap:admin`

## 4. Các bước go-live

1. Bật maintenance window nội bộ nếu cần
2. Pull đúng branch hoặc tag đã chốt
3. Chạy:
   - `cd backend && npm run prisma:generate`
   - `cd backend && npm run prisma:deploy`
4. Chạy `bootstrap:admin` nếu là database production mới hoàn toàn
5. Build backend và frontend
6. Restart service backend và frontend
7. Kiểm tra reverse proxy
8. Kiểm tra:
   - `GET /api/v1/health`
   - `GET /api/v1/health/ready`

## 5. Smoke test bắt buộc ngay sau deploy

1. Đăng nhập bằng admin
2. Tạo hoặc kiểm tra store, user, ingredient unit, ingredient group, ingredient
3. Tạo 1 batch test và in tem
4. Quét 1 lượt `Sử dụng tại quán`
5. Thử scan offline rồi sync lại
6. Tạo 1 phiếu `Chuyển kho` từ chi nhánh A sang B
7. Đăng nhập manager hoặc admin ở chi nhánh B để xác nhận nhận
8. Mở `Control > Kho nguyên liệu` và kiểm tra số liệu
9. Mở `Control > Ca làm việc`, nhập thử phụ cấp và đi trễ hoặc về sớm
10. Thử `In bảng lương` hoặc `Xuất Excel`
11. Mở `Admin > Reports`
12. Kiểm tra `IP whitelist`, `scan/network-status`, `Emergency bypass`

## 6. Trong 24 giờ đầu

1. Theo dõi:
   - login thất bại
   - scan reject
   - sync offline lỗi
   - chuyển kho chờ xác nhận quá lâu
   - lỗi mở bảng lương hoặc export Excel
2. Kiểm tra định kỳ:
   - dashboard
   - scan logs
   - kho nguyên liệu
   - admin reports
3. Ghi lại tất cả lỗi phát sinh và workaround

## 7. Quy trình dự phòng khi có sự cố

### Khi mất mạng tại chi nhánh

1. Tiếp tục dùng chế độ `Sử dụng tại quán` trên thiết bị đã đăng nhập
2. Không thực hiện `Chuyển kho` trong lúc offline
3. Khi có mạng lại, mở màn scan để hệ thống tự sync
4. Quản lý chi nhánh kiểm tra lại `Scan Logs`

### Khi backend production lỗi

1. Tạm dừng thao tác quản trị mới
2. Giữ lại bằng chứng lỗi:
   - thời điểm xảy ra
   - màn hình lỗi
   - user bị ảnh hưởng
3. Người phụ trách kỹ thuật kiểm tra:
   - `health/ready`
   - log backend
   - trạng thái database
4. Nếu lỗi do bản deploy mới:
   - rollback ứng dụng về bản ổn định gần nhất
   - chạy lại smoke test tối thiểu
5. Nếu nghi ngờ lỗi dữ liệu:
   - restore vào database test trước
   - chỉ restore production sau khi xác nhận dữ liệu đúng

## 8. Điều kiện rollback

Rollback nên được thực hiện nếu xảy ra một trong các tình huống sau:

1. User không đăng nhập được hàng loạt
2. Scan thành công nhưng số liệu tồn kho sai rõ ràng
3. Chuyển kho không tạo được hoặc xác nhận nhận làm lệch kho
4. Bảng lương tính sai hàng loạt
5. Hệ thống lỗi liên tục trong giờ vận hành mà không có workaround an toàn

## 9. Chốt sau go-live

1. Xác nhận backup đêm đầu tiên chạy thành công
2. Ghi lại các lỗi ngày đầu và mức độ ảnh hưởng
3. Chốt danh sách cải tiến sau pilot
4. Chỉ mở rộng thêm chi nhánh khi 2 chi nhánh đầu đã vận hành ổn định
