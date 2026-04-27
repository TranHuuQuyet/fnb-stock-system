# FNB Stock Control System

Hệ thống kiểm soát sử dụng nguyên liệu theo lô cho chuỗi F&B, gồm backend NestJS + Prisma + PostgreSQL và frontend Next.js PWA ưu tiên quét camera, có lớp IndexedDB để đồng bộ luồng legacy khi cần.

## Tech Stack

- Backend: Node.js 20+, NestJS, Prisma, PostgreSQL, JWT, Swagger
- Frontend: Next.js 14 App Router, TypeScript, TailwindCSS, React Query, react-hook-form, zod, html5-qrcode, idb
- DevOps: Docker, Docker Compose

## Project Structure

```text
backend/     NestJS API + Prisma schema + seed + tests
frontend/    Next.js PWA + camera-first scan UI + admin/control UI + legacy IndexedDB sync support
docs/        Architecture, API overview, operation manual, production deployment
```

## Operational Docs

- `docs/USECASE_OVERVIEW.md`: use case hiện tại theo role và các luồng nghiệp vụ chính
- `docs/ARCHITECTURE.md`: kiến trúc module và luồng dữ liệu
- `docs/API_OVERVIEW.md`: tổng hợp API chính
- `docs/OPERATION_MANUAL.md`: hướng dẫn vận hành hằng ngày
- `docs/DEPLOYMENT_STATUS.md`: trạng thái triển khai hiện tại và các mốc rollout đã hoàn thành
- `docs/DEPLOYMENT_PROD.md`: hướng dẫn triển khai production
- `docs/VPS_OPERATIONS.md`: runbook thao tác thực tế trên VPS production, ưu tiên lệnh copy-paste
- `docs/BACKUP_RESTORE.md`: runbook backup và restore
- `docs/BUY_AND_SETUP_CHECKLIST.md`: checklist mua dịch vụ, cấu hình VPS và dựng staging
- `docs/RELEASE_RUNBOOK.md`: runbook staging, release tag, deploy và rollback
- `docs/PILOT_RUNBOOK.md`: runbook pilot 2 chi nhánh đầu tiên
- `docs/RELEASE_TEMPLATE.md`: mẫu biên bản release trước pilot/go-live
- `docs/STAGING_CHECKLIST.md`: checklist dựng staging
- `docs/UAT_CHECKLIST.md`: checklist kiểm thử chấp nhận người dùng
- `docs/GO_LIVE_CHECKLIST.md`: checklist ngày go-live

## Current Rollout Status

- Cập nhật gần nhất `2026-04-22`: admin production đầu tiên đã được tạo và đã đổi mật khẩu sau lần đăng nhập đầu tiên.
- `https://fnbstore.store` đã trả `HTTP 200` và `https://fnbstore.store/api/v1/health` đã trả `status=ok`.
- Repo đã có thêm `./ops.sh` và [docs/VPS_OPERATIONS.md](docs/VPS_OPERATIONS.md) để vận hành production hằng ngày trên VPS.
- Các bước còn lại nên tiếp tục chốt ở `docs/DEPLOYMENT_STATUS.md`: smoke test production đầy đủ, backup/restore, release gate, monitoring và alerting.

## Main Features

- Quản lý lô hàng nguyên liệu theo cửa hàng
- Quản lý danh mục nguyên liệu có `đơn vị` và `nhóm nguyên liệu`
- Quản lý `đơn vị nguyên liệu` riêng để tái sử dụng trong form admin
- Quét nguyên liệu bằng camera theo quick mode; API `manual/sync` vẫn còn để tương thích luồng cũ
- Hỗ trợ `Sử dụng tại quán` và `Chuyển kho` giữa các chi nhánh theo mô hình `in transit -> xác nhận nhận`
- FIFO validation, soft lock, expired/depleted checks
- Quick scan web hiện tại yêu cầu online đúng mạng chi nhánh; IndexedDB sync layer chỉ còn cho compatibility cũ
- Màn `Kho nguyên liệu` theo tháng/chi nhánh/phạm vi, tự cộng số lượng theo ngày và ca
- Bộ lọc `Loại nguyên liệu / Nguyên liệu` trên cả desktop và mobile để quan sát nhanh hơn
- Giao diện mobile cho `Kho nguyên liệu` dùng thẻ tóm tắt, chạm để bung chi tiết ngày/ca
- Màn `Ca làm việc` để sắp ca theo tháng, theo dõi giờ thử việc/chính thức, phụ cấp, đi trễ/về sớm, in bảng chấm công và bảng lương
- Màn `Báo cáo admin` để xem tồn kho hiện tại, hao hụt, lịch sử batch, top nguyên liệu dùng nhiều và tổng hợp bảng lương
- Xóa mềm `user/store` có xác thực lại mật khẩu admin để giữ nguyên lịch sử batch, scan và audit
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

`docker-compose.yml` hiện dùng cho local/demo và đã truyền cả `DATABASE_URL` lẫn `DIRECT_URL` để Prisma boot đúng với schema hiện tại. Không nên dùng nguyên xi cho production vì backend đang tự chạy `db:seed`, frontend/backend còn mặc định `localhost`, và secret trong compose chỉ là placeholder. Xem thêm [docs/DEPLOYMENT_PROD.md](docs/DEPLOYMENT_PROD.md).

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
4. Điền domain thật `fnbstore.store`, secret thật, `DATABASE_URL` runtime và `DIRECT_URL` direct cho Prisma migrate
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
- `.github/workflows/post-deploy-smoke.yml`: workflow chạy tay sau deploy để smoke test staging hoặc production trên URL thật
- `.github/workflows/release-evidence.yml`: workflow chạy tay để lưu artifact biên bản release với backup manifest, smoke run và rollback tag

Production hardening update:

- login production chỉ trả `user` + `mustChangePassword`; `accessToken` chỉ còn nằm trong `HttpOnly cookie`
- JWT có `sessionVersion` để logout, reset password, lock/unlock user và đổi mật khẩu có thể revoke session cũ ngay
- `docker-compose.prod.yml` dùng readiness check `/api/v1/health/ready` cho backend
- có thêm script `deploy/scripts/backup-postgres.ps1` và `deploy/scripts/restore-postgres.ps1`
- xem thêm `docs/PRODUCTION_HARDENING.md`

Repo cũng đã có script smoke test nhanh sau deploy. Các lệnh `powershell ...` dưới đây dành cho máy operator có PowerShell; trên VPS Linux ưu tiên `./ops.sh`:

- `powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://fnbstore.store`
- `powershell -ExecutionPolicy Bypass -File deploy/scripts/init-staging.ps1`
- `powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging`
- `./ops.sh status` để kiểm tra nhanh production ngay trên VPS Linux

Quick ops trên VPS Linux:

```bash
chmod +x ops.sh deploy/scripts/prod-ops.sh
./ops.sh status
./ops.sh up
./ops.sh rebuild
./ops.sh logs backend 200
```

If `./ops.sh` returns `No such file or directory` on the VPS, that server checkout has not pulled the wrapper script yet. Use:

```bash
git status --short
# if git status is not empty, stop here and inspect the VPS changes first
git pull --ff-only origin main
chmod +x ops.sh deploy/scripts/prod-ops.sh
./ops.sh status
```

If you need to operate immediately before updating the checkout, run the real script directly:

```bash
./deploy/scripts/prod-ops.sh status
```

Nếu cần một tài liệu thao tác theo đúng máy production hiện tại ở `/opt/fnb-stock-system`, xem [docs/VPS_OPERATIONS.md](docs/VPS_OPERATIONS.md).

## Database Commands

- Regenerate Prisma client: `cd backend && npm run prisma:generate`
- Migrate dev: `cd backend && npm run prisma:migrate:dev`
- Reset database: `cd backend && npm run db:reset`
- Seed data: `cd backend && npm run db:seed`

## Default Accounts (Local/Demo Only)

Các tài khoản dưới đây chỉ áp dụng cho local/demo khi dùng seed. Production không nên dùng các credential này; tài khoản admin production phải được tạo bằng `bootstrap:admin` và đổi mật khẩu ngay sau lần đăng nhập đầu tiên.

- `admin / 123456`
- `manager1 / 123456`
- `staff1 / 123456`
- `staff2 / 123456` -> bắt buộc đổi mật khẩu lần đầu

## Main URLs

- Frontend (Docker Compose): `http://localhost:3001`
- Frontend (local dev): `http://localhost:3000`
- Default route sau login: `ADMIN -> /admin/reports`, `MANAGER/STAFF -> /scan`
- Backend API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- Health: `http://localhost:4000/api/v1/health`
- Ingredient stock board: `http://localhost:3001/ingredient-stock`
- Work schedules: `http://localhost:3001/work-schedules`
- Admin reports: `http://localhost:3001/admin/reports`

## Test Commands

- Backend unit tests: `cd backend && npm test -- --runInBand`
- Backend route contract tests (controller-level, dùng mocked services): `cd backend && npm run test:e2e`
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
8. Vào màn `Scan`, quét tem vừa in để quick consume `1 đơn vị`
9. Kiểm tra banner mạng, phản hồi lần quét gần nhất và số lượng còn lại của lô
10. Đăng nhập `manager1 / 123456`
11. Thử chuyển sang chế độ `Chuyển kho`, tạo một phiếu chuyển thử rồi mở `Scan logs` để kiểm tra phiếu `IN_TRANSIT`
12. Mở `Kho nguyên liệu`, `Ca làm việc`; đăng nhập lại `admin` để mở `Admin reports`

## QR Formats

Hệ thống hiện hỗ trợ cả hai định dạng QR sau:

- Legacy: `FNBBATCH:<batch_code>`
- Tem đã phát hành: `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`

Scanner frontend sẽ tự tách `batchCode` từ cả hai định dạng trên.

## Notes

- Luồng web hiện tại ưu tiên `IP whitelist` và `Emergency bypass`; `SSID` chỉ là field optional trong browser flow.
- IndexedDB sync layer vẫn giữ nguyên `clientEventId` để idempotent, nhưng quick scan web hiện tại không tạo queue mới khi mất mạng.
- Phiếu chuyển kho chỉ cộng tồn ở chi nhánh nhận sau khi bên nhận xác nhận số lượng thực nhận.
- Tính năng in tem mới phụ thuộc migration thêm field `printedLabelCount` vào `IngredientBatch`.
- Tính năng `Kho nguyên liệu` phụ thuộc các bảng `IngredientGroup`, `IngredientStockLayout`, `IngredientStockLayoutGroup`, `IngredientStockLayoutItem`.
- Tính năng `Ca làm việc` phụ thuộc các bảng `WorkSchedule`, `WorkScheduleShift`, `WorkScheduleEmployee`, `WorkScheduleEntry`.
- Tính năng `Báo cáo admin` lấy dữ liệu từ `IngredientBatch`, `StockAdjustment`, `ScanLog` và `WorkSchedule`.
- Bảng `Kho nguyên liệu` lấy dữ liệu từ `ScanLog` thành công/cảnh báo, cộng theo `ngày / ca / phạm vi sử dụng`.
- `Số lượng tồn` trên `Kho nguyên liệu` là tổng tồn của tất cả lô còn lại của cùng nguyên liệu trong chi nhánh đang chọn.
- Route frontend preview cũ `/admin/batches/[id]/label` hiện redirect sang màn in mới.
- Trang chủ hiện redirect `ADMIN` sang `Admin reports`, còn `MANAGER/STAFF` sang `Scan`; `/dashboard` và `/admin/recipes` không còn là route web vận hành chính.

Chi tiết triển khai và vận hành nằm trong:

- `docs/USECASE_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/API_OVERVIEW.md`
- `docs/OPERATION_MANUAL.md`
- `docs/DEPLOYMENT_PROD.md`
- `docs/BACKUP_RESTORE.md`
- `docs/BUY_AND_SETUP_CHECKLIST.md`
- `docs/RELEASE_RUNBOOK.md`
- `docs/PILOT_RUNBOOK.md`
- `docs/RELEASE_TEMPLATE.md`
- `docs/PILOT_DAILY_LOG_TEMPLATE.md`
