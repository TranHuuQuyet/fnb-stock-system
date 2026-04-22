# Staging Checklist

Tai lieu nay dung de dung moi truong staging gan giong production nhat co the truoc khi chay UAT va pilot. Neu can chot tag release, rollback hoac ban giao deploy, xem them [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md). Trang thai rollout cua moi truong dang test nen duoc ghi song song tai [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md).

## 1. Muc tieu staging

- Kiem tra quy trinh deploy khong dung du lieu demo
- Kiem tra migrate, bootstrap admin, backup va smoke test tren moi truong gan production
- Tao noi de test nghiep vu truoc khi mo cho chi nhanh that

## 2. Cau hinh khuyen nghi

- Domain chinh production: `https://fnbstore.store`
- Goi y staging:
  - `https://staging.fnbstore.store`
  - hoac 1 URL tam rieng chi cho doi trien khai
- Frontend va backend di cung 1 domain, API theo dang `/api/v1`
- Dung cung kieu ha tang voi production:
  - `1 VPS chay app`
  - `1 PostgreSQL managed`
- Staging phai dung secret va database rieng, khong dung chung file production

## 3. Checklist ha tang

1. VPS da san sang:
   - toi thieu `2 vCPU`, `4 GB RAM`, `40 GB SSD`
2. PostgreSQL staging da tao rieng
3. DNS hoac URL staging da tro dung
4. HTTPS da san sang
5. Co user chay service rieng, khong chay duoi `root`
6. Co thu muc chua log va backup

## 4. Checklist cau hinh

1. Tao `.env.staging.compose` cho staging
2. Tao `backend/.env.staging` cho staging
3. Tao `frontend/.env.staging` cho staging
4. Kiem tra cac bien bat buoc:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN`
   - `NEXT_PUBLIC_API_BASE_URL`
5. Khuyen nghi dat `NEXT_PUBLIC_API_BASE_URL=/api/v1`; neu tach backend rieng domain thi dung URL public cua staging
6. Xac nhan khong con gia tri `localhost` trong env staging
7. Khuyen nghi copy tu cac file mau:
   - `.env.staging.compose.example`
   - `backend/.env.staging.example`
   - `frontend/.env.staging.example`
   - `deploy/.env.ops.example`

## 5. Checklist deploy

1. Pull code dung branch hoac tag can kiem thu
2. Neu dung compose staging, chay:
   - `docker compose --env-file .env.staging.compose -f docker-compose.prod.yml up -d --build`
3. Neu khong dung compose, cai dependencies bang `npm ci`
4. Chay:
   - `cd backend && npm run prisma:generate`
   - `cd backend && npm run prisma:deploy`
5. Khong chay `npm run db:seed`
6. Chay `bootstrap:admin` de tao admin dau tien
   - sau khi dang nhap lan dau va doi mat khau, cap nhat `DEPLOYMENT_STATUS.md`
7. Build:
   - `cd backend && npm run build`
   - `cd frontend && npm run build`
8. Start service backend va frontend
9. Kiem tra reverse proxy va TLS

## 6. Checklist smoke test staging

1. Mo frontend staging
2. Dang nhap bang admin bootstrap
3. Kiem tra:
   - `/api/v1/health`
   - `/api/v1/health/ready`
4. Tao 2 chi nhanh test
5. Tao manager va staff cho moi chi nhanh
6. Tao ingredient unit, ingredient group, ingredient
7. Tao batch, in tem, quet online
8. Thu scan offline o che do `Su dung tai quan`
9. Thu chuyen kho:
   - tao phieu o chi nhanh A
   - xac nhan nhan o chi nhanh B
10. Thu `Ca lam viec`:
   - nhap gio
   - nhap phu cap
   - nhap di tre hoac ve som
   - in bang luong
   - xuat Excel
11. Mo `Admin > Reports`
12. Thu cau hinh `IP whitelist` va `Emergency bypass`
13. Chay workflow GitHub Actions `Post-Deploy Smoke Test` voi `target_environment=staging`
14. Khuyen nghi chay gate day du:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment staging`

## 7. Checklist du lieu test

1. Khong dung du lieu demo mac dinh cua local de kiem thu staging
2. Tao du lieu test gan giong that:
   - 2 chi nhanh
   - it nhat 5 nhan vien
   - it nhat 5 batch
   - it nhat 2 phieu chuyen kho
   - it nhat 1 bang cham cong thang
3. Ghi ro du lieu nao la du lieu test de xoa hoac reset truoc khi go-live production

## 8. Checklist backup va restore tren staging

1. Tao 1 ban backup staging
   - luu lai `backup manifest` hoac duong dan file backup
2. Restore ban do vao database test rieng
3. Kiem tra du lieu sau restore
4. Ghi lai thoi gian backup va thoi gian restore thuc te
5. Xac nhan nguoi phu trach ky thuat nam duoc quy trinh restore
6. Neu co the, chay restore drill bang cung script dung cho production de tranh sai khac giua moi truong

## 9. Dieu kien pass staging

Staging duoc coi la san sang cho UAT khi:

1. Deploy thanh cong khong dung `db:seed`
2. Admin bootstrap dang nhap duoc
3. Admin bootstrap da doi mat khau lan dau neu day la moi truong moi
4. Cac smoke test chinh deu pass
5. Da test backup va restore it nhat 1 lan
6. Tai lieu [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md), [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) va [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) du de nguoi trien khai khac lam lai duoc
