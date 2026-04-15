# Staging Checklist

Tài liệu này dùng để dựng môi trường staging gần giống production nhất có thể trước khi chạy UAT và pilot.

## 1. Mục tiêu staging

- Kiểm tra quy trình deploy không dùng dữ liệu demo
- Kiểm tra migrate, bootstrap admin, backup và smoke test trên môi trường gần production
- Tạo nơi để test nghiệp vụ trước khi mở cho chi nhánh thật

## 2. Cấu hình khuyến nghị

- Domain chính production: `https://fnbstore.store`
- Gợi ý staging:
  - `https://staging.fnbstore.store`
  - hoặc 1 URL tạm riêng chỉ cho đội triển khai
- Frontend và backend đi cùng 1 domain, API theo dạng `/api/v1`
- Dùng cùng kiểu hạ tầng với production:
  - `1 VPS chạy app`
  - `1 PostgreSQL managed`

## 3. Checklist hạ tầng

1. VPS đã sẵn sàng:
   - tối thiểu `2 vCPU`, `4 GB RAM`, `40 GB SSD`
2. PostgreSQL staging đã tạo riêng
3. DNS hoặc URL staging đã trỏ đúng
4. HTTPS đã sẵn sàng
5. Có user chạy service riêng, không chạy dưới `root`
6. Có thư mục chứa log và backup

## 4. Checklist cấu hình

1. Tạo `backend/.env.production` cho staging
2. Tạo `frontend/.env.production` cho staging
3. Kiểm tra các biến bắt buộc:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN`
   - `NEXT_PUBLIC_API_BASE_URL`
4. Xác nhận `NEXT_PUBLIC_API_BASE_URL` dùng đúng domain staging
5. Xác nhận không còn giá trị `localhost` trong env staging

## 5. Checklist deploy

1. Pull code đúng branch hoặc tag cần kiểm thử
2. Cài dependencies bằng `npm ci`
3. Chạy:
   - `cd backend && npm run prisma:generate`
   - `cd backend && npm run prisma:deploy`
4. Không chạy `npm run db:seed`
5. Chạy `bootstrap:admin` để tạo admin đầu tiên
6. Build:
   - `cd backend && npm run build`
   - `cd frontend && npm run build`
7. Start service backend và frontend
8. Kiểm tra reverse proxy và TLS

## 6. Checklist smoke test staging

1. Mở frontend staging
2. Đăng nhập bằng admin bootstrap
3. Kiểm tra:
   - `/api/v1/health`
   - `/api/v1/health/ready`
4. Tạo 2 chi nhánh test
5. Tạo manager và staff cho mỗi chi nhánh
6. Tạo ingredient unit, ingredient group, ingredient
7. Tạo batch, in tem, quét online
8. Thử scan offline ở chế độ `Sử dụng tại quán`
9. Thử chuyển kho:
   - tạo phiếu ở chi nhánh A
   - xác nhận nhận ở chi nhánh B
10. Thử `Ca làm việc`:
   - nhập giờ
   - nhập phụ cấp
   - nhập đi trễ hoặc về sớm
   - in bảng lương
   - xuất Excel
11. Mở `Admin > Reports`
12. Thử cấu hình `IP whitelist` và `Emergency bypass`

## 7. Checklist dữ liệu test

1. Không dùng dữ liệu demo mặc định của local để kiểm thử staging
2. Tạo dữ liệu test gần giống thật:
   - 2 chi nhánh
   - ít nhất 5 nhân viên
   - ít nhất 5 batch
   - ít nhất 2 phiếu chuyển kho
   - ít nhất 1 bảng chấm công tháng
3. Ghi rõ dữ liệu nào là dữ liệu test để xóa hoặc reset trước khi go-live production

## 8. Checklist backup và restore trên staging

1. Tạo 1 bản backup staging
2. Restore bản đó vào database test riêng
3. Kiểm tra dữ liệu sau restore
4. Ghi lại thời gian backup và thời gian restore thực tế
5. Xác nhận người phụ trách kỹ thuật nắm được quy trình restore

## 9. Điều kiện pass staging

Staging được coi là sẵn sàng cho UAT khi:

1. Deploy thành công không dùng `db:seed`
2. Admin bootstrap đăng nhập được
3. Các smoke test chính đều pass
4. Đã test backup và restore ít nhất 1 lần
5. Tài liệu [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md) và [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) đủ để người triển khai khác làm lại được
