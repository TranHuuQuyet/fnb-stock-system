# FNB Stock Control System

Hệ thống kiểm soát sử dụng nguyên liệu theo lô cho chuỗi F&B, gồm backend NestJS + Prisma + PostgreSQL và frontend Next.js PWA có offline queue bằng IndexedDB.

## Tech Stack

- Backend: Node.js 20+, NestJS, Prisma, PostgreSQL, JWT, Swagger
- Frontend: Next.js 14 App Router, TypeScript, TailwindCSS, React Query, react-hook-form, zod, html5-qrcode, idb
- DevOps: Docker, Docker Compose

## Project Structure

```text
backend/     NestJS API + Prisma schema + seed + tests
frontend/    Next.js PWA + IndexedDB offline queue + admin/dashboard UI
docs/        Architecture, API overview, operation manual, production deployment
```

## Operational Docs

- `docs/ARCHITECTURE.md`: kiến trúc module và luồng dữ liệu
- `docs/API_OVERVIEW.md`: tổng hợp API chính
- `docs/OPERATION_MANUAL.md`: hướng dẫn vận hành hằng ngày
- `docs/DEPLOYMENT_PROD.md`: hướng dẫn triển khai production
- `docs/BACKUP_RESTORE.md`: runbook backup và restore
- `docs/RELEASE_RUNBOOK.md`: runbook staging, release tag, deploy và rollback
- `docs/PILOT_RUNBOOK.md`: runbook pilot 2 chi nhánh đầu tiên
- `docs/RELEASE_TEMPLATE.md`: mẫu biên bản release trước pilot/go-live
- `docs/STAGING_CHECKLIST.md`: checklist dựng staging
- `docs/UAT_CHECKLIST.md`: checklist kiểm thử chấp nhận người dùng
- `docs/GO_LIVE_CHECKLIST.md`: checklist ngày go-live

## Main Features

- Quản lý lô hàng nguyên liệu theo cửa hàng
- Quản lý danh mục nguyên liệu có `đơn vị` và `nhóm nguyên liệu`
- Quản lý `đơn vị nguyên liệu` riêng để tái sử dụng trong form admin
- Quét nguyên liệu bằng camera hoặc nhập tay
- Hỗ trợ `Sử dụng tại quán` và `Chuyển kho` giữa các chi nhánh theo mô hình `in transit -> xác nhận nhận`
- FIFO validation, soft lock, expired/depleted checks
- Offline queue bằng IndexedDB và auto sync khi có mạng
- Màn `Kho nguyên liệu` theo tháng/chi nhánh/phạm vi, tự cộng số lượng theo ngày và ca
- Bộ lọc `Loại nguyên liệu / Nguyên liệu` trên cả desktop và mobile để quan sát nhanh hơn
- Giao diện mobile cho `Kho nguyên liệu` dùng thẻ tóm tắt, chạm để bung chi tiết ngày/ca
- Màn `Ca làm việc` để sắp ca theo tháng, theo dõi giờ thử việc/chính thức, phụ cấp, đi trễ/về sớm, in bảng chấm công và bảng lương
- Màn `Báo cáo admin` để xem tồn kho hiện tại, hao hụt, lịch sử batch, top nguyên liệu dùng nhiều và tổng hợp bảng lương
- In tem theo từng lô với `Number` tuần tự
- Mỗi tem có QR riêng để giảm rủi ro gian lận
- `MANAGER` được chuyển kho theo role; `ADMIN` có thể cấp quyền `scan_transfer` cho `STAFF` khi cần thao tác chuyển kho
- Hỗ trợ `IP whitelist`, lấy IP backend đang nhìn thấy và `Emergency bypass` có thời hạn cho từng chi nhánh
- Mặc định hỗ trợ in `10 tem/trang` và cho phép chỉnh bố cục trên màn in

## Local Setup

1. Copy env files:
   - `backend/.env.example` -> `backend/.env`
   - `frontend/.env.example` -> `frontend/.env.local`
2. Install dependencies:
   - `cd backend && npm install`
   - `cd frontend && npm install`
3. Generate Prisma client:
   - `cd backend && npm run prisma:generate`
4. Run migrations:
   - `cd backend && npm run prisma:migrate:dev`
5. Seed demo data:
   - `cd backend && npm run db:seed`
6. Start backend:
   - `cd backend && npm run start:dev`
7. Start frontend:
   - `cd frontend && npm run dev`

## Docker Run

```bash
docker compose up --build
```

`docker-compose.yml` hiện dùng cho local/demo. Không nên dùng nguyên xi cho production vì backend đang tự chạy `db:seed`, frontend/backend còn mặc định `localhost`, và secret trong compose chỉ là placeholder. Xem thêm [docs/DEPLOYMENT_PROD.md](docs/DEPLOYMENT_PROD.md).

Nếu muốn chạy production bằng container, repo đã có sẵn:

- `docker-compose.prod.yml`
- `.env.staging.compose.example`
- `backend/Dockerfile.prod`
- `frontend/Dockerfile.prod`
- `deploy/caddy/Caddyfile`
- `.env.production.compose.example`

Luồng khuyến nghị:

1. Copy `.env.production.compose.example` thành `.env.production.compose`
2. Copy `backend/.env.production.example` thành `backend/.env.production`
3. Copy `frontend/.env.production.example` thành `frontend/.env.production`
4. Điền domain thật `fnbstore.store`, secret thật và `DATABASE_URL` production
5. Chạy `docker compose --env-file .env.production.compose -f docker-compose.prod.yml up -d --build`

Container boot flow:

- `migrate`: job một lần để chờ DB rồi chạy `prisma migrate deploy`
- `backend`: chỉ start API sau khi migrate thành công
- `frontend`: dùng `Next.js standalone` cho runtime gọn hơn
- `caddy`: reverse proxy + TLS cho cùng 1 domain production

CI/CD hiện có tại `.github/workflows/docker-image.yml`:

- `pull_request`: chạy test/build cho backend + frontend và validate `docker-compose.prod.yml`
- `push main`: chỉ build/push image GHCR sau khi job verify pass
- `push tag v*`: push thêm image tag theo release để chốt mốc deploy/rollback rõ ràng hơn

Repo cũng đã có script smoke test nhanh sau deploy:

- `powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://fnbstore.store`
- `powershell -ExecutionPolicy Bypass -File deploy/scripts/init-staging.ps1`
- `powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging`

## Database Commands

- Regenerate Prisma client: `cd backend && npm run prisma:generate`
- Migrate dev: `cd backend && npm run prisma:migrate:dev`
- Reset database: `cd backend && npm run db:reset`
- Seed data: `cd backend && npm run db:seed`

## Default Accounts

- `admin / 123456`
- `manager1 / 123456`
- `staff1 / 123456`
- `staff2 / 123456` -> bắt buộc đổi mật khẩu lần đầu

## Main URLs

- Frontend (Docker Compose): `http://localhost:3001`
- Frontend (local dev): `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- Health: `http://localhost:4000/api/v1/health`
- Ingredient stock board: `http://localhost:3001/ingredient-stock`
- Work schedules: `http://localhost:3001/work-schedules`
- Admin reports: `http://localhost:3001/admin/reports`

## Test Commands

- Backend unit tests: `cd backend && npm test -- --runInBand`
- Backend e2e contract tests: `cd backend && npm run test:e2e`
- Frontend tests: `cd frontend && npm test`
- Backend build: `cd backend && npm run build`
- Frontend build: `cd frontend && npm run build`

## Demo Flow

1. Đăng nhập `admin / 123456`
2. Vào `Admin > Batches`, tạo batch mới hoặc dùng batch seed
3. Nhập số tem cần in cho lô
4. Mở màn `In tem`
5. Bấm `Tạo tem và mở in`
6. Kiểm tra mỗi tem có `Number` riêng và QR riêng
7. Mở frontend ở `http://localhost:3001` và đăng nhập `staff1 / 123456`
8. Vào màn scan, quét QR trên tem vừa in hoặc nhập tay batch code
9. Tắt mạng để thử offline queue, bật lại để auto sync
10. Đăng nhập `manager1 / 123456`
11. Mở dashboard, xem reconciliation, fraud attempts và anomaly alerts
12. Mở `Control > Ca làm việc`, kiểm tra bảng chấm công tháng hiện tại, thử `In bảng lương` hoặc `Xuất Excel`

## QR Formats

Hệ thống hiện hỗ trợ cả hai định dạng QR sau:

- Legacy: `FNBBATCH:<batch_code>`
- Tem đã phát hành: `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`

Scanner frontend sẽ tự tách `batchCode` từ cả hai định dạng trên.

## Notes

- Luồng web hiện tại ưu tiên `IP whitelist` và `Emergency bypass`; `SSID` chỉ là field optional trong browser flow.
- Frontend queue scan offline bằng IndexedDB thật, giữ nguyên `clientEventId` để sync idempotent.
- Phiếu chuyển kho chỉ cộng tồn ở chi nhánh nhận sau khi bên nhận xác nhận số lượng thực nhận.
- Tính năng in tem mới phụ thuộc migration thêm field `printedLabelCount` vào `IngredientBatch`.
- Tính năng `Kho nguyên liệu` phụ thuộc các bảng `IngredientGroup`, `IngredientStockLayout`, `IngredientStockLayoutGroup`, `IngredientStockLayoutItem`.
- Tính năng `Ca làm việc` phụ thuộc các bảng `WorkSchedule`, `WorkScheduleShift`, `WorkScheduleEmployee`, `WorkScheduleEntry`.
- Tính năng `Báo cáo admin` lấy dữ liệu từ `IngredientBatch`, `StockAdjustment`, `ScanLog` và `WorkSchedule`.
- Bảng `Kho nguyên liệu` lấy dữ liệu từ `ScanLog` thành công/cảnh báo, cộng theo `ngày / ca / phạm vi sử dụng`.
- `Số lượng tồn` trên `Kho nguyên liệu` là tổng tồn của tất cả lô còn lại của cùng nguyên liệu trong chi nhánh đang chọn.
- Route frontend preview cũ `/admin/batches/[id]/label` hiện redirect sang màn in mới.

Chi tiết triển khai và vận hành nằm trong:

- `docs/ARCHITECTURE.md`
- `docs/API_OVERVIEW.md`
- `docs/OPERATION_MANUAL.md`
- `docs/DEPLOYMENT_PROD.md`
- `docs/BACKUP_RESTORE.md`
- `docs/RELEASE_RUNBOOK.md`
- `docs/PILOT_RUNBOOK.md`
- `docs/RELEASE_TEMPLATE.md`
- `docs/PILOT_DAILY_LOG_TEMPLATE.md`
