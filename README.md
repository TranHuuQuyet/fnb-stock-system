# FNB Stock Control System

Hệ thống kiểm soát sử dụng nguyên liệu theo batch cho chuỗi F&B, gồm backend NestJS + Prisma + PostgreSQL và frontend Next.js PWA có offline queue bằng IndexedDB.

## Tech Stack

- Backend: Node.js 20+, NestJS, Prisma, PostgreSQL, JWT, Swagger
- Frontend: Next.js 14 App Router, TypeScript, TailwindCSS, React Query, react-hook-form, zod, html5-qrcode, idb
- DevOps: Docker, Docker Compose

## Project Structure

```text
backend/     NestJS API + Prisma schema + seed + tests
frontend/    Next.js PWA + IndexedDB offline queue + admin/dashboard UI
docs/        Architecture, API overview, operation manual
```

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

Container boot flow:

- `postgres`: PostgreSQL 15
- `backend`: chạy `prisma migrate deploy`, `db:seed`, rồi start API
- `frontend`: build Next.js và publish tại host port `3001`

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

## Test Commands

- Backend unit tests: `cd backend && npm test`
- Backend e2e contract tests: `cd backend && npm run test:e2e`
- Frontend tests: `cd frontend && npm test`

## Demo Flow

1. Đăng nhập `admin / 123456`
2. Vào `Admin > Batches`, tạo batch mới hoặc dùng batch seed
3. Generate QR và mở label preview để in tem
4. Mở frontend ở `http://localhost:3001` và đăng nhập `staff1 / 123456`
5. Vào màn scan, quét QR `FNBBATCH:<batch_code>` hoặc nhập tay batch code
6. Tắt mạng để thử offline queue, bật lại để auto sync
7. Đăng nhập `manager1 / 123456`
8. Mở dashboard, xem reconciliation, fraud attempts và anomaly alerts

## Notes

- SSID trong web browser chỉ là field optional, chống gian lận hiện tại dựa chính vào IP whitelist.
- Frontend queue scan offline bằng IndexedDB thật, giữ nguyên `clientEventId` để sync idempotent.
- QR tem batch có format chuẩn `FNBBATCH:<batch_code>`.

Chi tiết triển khai và vận hành nằm trong:

- `docs/ARCHITECTURE.md`
- `docs/API_OVERVIEW.md`
- `docs/OPERATION_MANUAL.md`
