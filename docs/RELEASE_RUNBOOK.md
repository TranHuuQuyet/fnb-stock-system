# Release Runbook

Tai lieu nay dung de chot ban staging, tag release, deploy production va rollback khi can. Muc tieu la de ban co mot quy trinh lap lai duoc cho `fnbstore.store`, thay vi deploy thu cong theo tri nho.

Nen dung kem cac tai lieu sau:

- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md)
- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [UAT_CHECKLIST.md](./UAT_CHECKLIST.md)
- [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md)
- [RELEASE_TEMPLATE.md](./RELEASE_TEMPLATE.md)

## 1. Muc tieu moi dot release

- Xac dinh ro ban nao dang o staging
- Xac dinh ro ban nao da deploy production
- Co moc rollback ro rang neu ban moi co su co
- Dam bao nguoi khac trong doi van co the lam lai dung quy trinh
- Cap nhat [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) sau moi moc quan trong de ca doi cung theo doi cung 1 trang thai rollout

## 2. Quy uoc branch va tag

Khuyen nghi:

- `main`: branch on dinh nhat, chi merge khi verify pass
- `release/*`: branch tam neu can gom fix cho mot dot go-live
- tag production: `vYYYY.MM.DD.N`

Vi du:

- `v2026.04.16.1`
- `v2026.04.20.1`

Moi tag release can tro toi mot commit da:

1. pass test/build
2. pass staging smoke test
3. co bien ban UAT hoac ghi chu loi con lai
4. co moc rollback ro rang: tag cu, image cu, backup moi nhat

## 3. Quy trinh staging

### 3.1 Chuan bi env staging

Repo da co san:

- `.env.staging.compose.example`
- `backend/.env.staging.example`
- `frontend/.env.staging.example`
- `deploy/.env.ops.example`

Copy thanh file that:

```bash
cp .env.staging.compose.example .env.staging.compose
cp backend/.env.staging.example backend/.env.staging
cp frontend/.env.staging.example frontend/.env.staging
cp deploy/.env.ops.example deploy/.env.ops
```

Sau do dien gia tri staging that:

- `APP_DOMAIN=staging.fnbstore.store`
- `DATABASE_URL` cua DB staging
- secret staging rieng

Neu chua tao file staging that, co the dung script tren may operator co PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/init-staging.ps1
```

### 3.2 Deploy staging bang compose

```bash
docker compose --env-file .env.staging.compose -f docker-compose.prod.yml up -d --build
```

### 3.3 Checklist pass staging

1. `docker compose ... ps` xanh
2. `GET /api/v1/health` pass
3. `GET /api/v1/health/ready` pass
4. login admin pass
5. smoke test theo [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) pass
6. backup va restore staging da test it nhat 1 lan

Co the chay nhanh bang script tren may operator:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment staging
```

Neu muon chay rieng smoke test sau deploy tu may operator:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://staging.fnbstore.store
```

Hoac chay workflow CI sau deploy:

- GitHub Actions > `Post-Deploy Smoke Test`
- `target_environment=staging`
- `require_auth=true` neu da cap environment secrets cho admin smoke test
- nhap `base_url` neu khong dung repo variable
- environment secrets can tao: `STAGING_SMOKE_ADMIN_USERNAME`, `STAGING_SMOKE_ADMIN_PASSWORD`

Release gate da gom san `preflight + backup manifest guard + smoke test`.

Neu chua pass, khong duoc tag release.

Neu staging la moi truong moi va vua bootstrap admin, hay cap nhat `DEPLOYMENT_STATUS.md` sau khi admin dang nhap va doi mat khau lan dau.

## 4. Chot release candidate

Sau khi staging pass:

1. Chot commit se deploy
2. Ghi nhanh:
   - pham vi thay doi
   - migration nao moi
   - risk con lai
   - cach rollback
3. Tao tag:

```bash
git tag v2026.04.16.1
git push origin v2026.04.16.1
```

Workflow CI/CD se build image tu tag nay. Can ghi lai:

- commit SHA
- tag release
- ngay deploy
- nguoi deploy
- backend image tag
- frontend image tag
- artifact `release-metadata-<tag>` tu workflow `CI and Docker Images`
- moc cap nhat moi nhat trong `DEPLOYMENT_STATUS.md`

## 5. Truoc khi deploy production

1. Xac nhan tag dung
2. Xac nhan `fnbstore.store` dang tro dung VPS
3. Xac nhan backup production vua duoc tao
   - co `backup manifest` hoac `backup id`
   - biet ro file backup dang nam o dau
   - biet nguoi se thao tac restore neu can
4. Xac nhan env production khong dung gia tri staging/demo
5. Xac nhan co ban release truoc do de rollback
   - tag release truoc do
   - image backend/frontend truoc do
   - ghi chu migration cua ban truoc do
6. Cap nhat `DEPLOYMENT_STATUS.md` voi trang thai truoc deploy:
   - admin bootstrap da xong chua
   - backup da co chua
   - smoke account da san sang chua
   - buoc nao van con pending
7. Chay preflight check tren may operator:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment production -RequireAuth
```

## 6. Trinh tu deploy production

### Neu dung compose production

1. Pull dung tag release
2. Copy hoac cap nhat:
   - `.env.production.compose`
   - `backend/.env.production`
   - `frontend/.env.production`
3. Neu admin dau tien da duoc tao va da doi mat khau truoc do, khong chay lai `bootstrap:admin`
4. Chay:

```bash
docker compose --env-file .env.production.compose -f docker-compose.prod.yml pull
docker compose --env-file .env.production.compose -f docker-compose.prod.yml up -d --build
```

5. Kiem tra:
   - `docker compose ... ps`
   - `https://fnbstore.store`
   - `https://fnbstore.store/api/v1/health`
   - `https://fnbstore.store/api/v1/health/ready`
6. Chay smoke test bat buoc theo [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
7. Chay them release gate tren may operator:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment production -RequireAuth
```

8. Chay workflow CI sau deploy:
   - GitHub Actions > `Post-Deploy Smoke Test`
   - `target_environment=production`
   - `base_url=https://fnbstore.store`
   - `require_auth=true`
   - environment secrets can tao: `PRODUCTION_SMOKE_ADMIN_USERNAME`, `PRODUCTION_SMOKE_ADMIN_PASSWORD`
9. Cap nhat `DEPLOYMENT_STATUS.md` sau deploy:
   - health/ready
   - smoke test
   - backup manifest
   - trang thai admin bootstrap
   - cac viec con lai can chot
10. Chay workflow `Release Evidence` de luu lai:
   - release tag
   - image da deploy
   - backup manifest
   - smoke run URL
   - rollback tag

### Neu dung image tu GHCR

Can ghi ro tag image da deploy:

- `ghcr.io/tranhuuquyet/fnb-stock-backend:<tag-or-sha>`
- `ghcr.io/tranhuuquyet/fnb-stock-frontend:<tag-or-sha>`

## 7. Bien ban release toi thieu

Moi dot deploy nen luu lai:

- moc cap nhat moi nhat trong `DEPLOYMENT_STATUS.md`
- release tag
- commit SHA
- backend image tag
- frontend image tag
- migration moi
- backup id hoac timestamp truoc deploy
- duong dan hoac manifest cua backup moi nhat
- ket qua smoke test
- link workflow `Post-Deploy Smoke Test` neu co
- artifact `release-metadata`
- artifact `release-evidence`
- loi con lai duoc chap nhan

Nen dung mau tai lieu tai [RELEASE_TEMPLATE.md](./RELEASE_TEMPLATE.md).

## 8. Rollback ung dung

Dung khi:

- login loi hang loat
- backend khong ready
- frontend build moi loi nghiem trong
- smoke test sau deploy fail

Trinh tu:

1. Dung thay doi nghiep vu moi
2. Xac dinh tag on dinh gan nhat, vi du `v2026.04.10.1`
3. Xac dinh image backend/frontend tuong ung voi tag cu
4. Checkout lai tag hoac doi image ve ban cu
5. Xac nhan migration moi co an toan khi app rollback ma khong rollback data hay khong
6. Redeploy app
7. Chay smoke test toi thieu:
   - login admin
   - health/ready
   - scan co ban
   - transfer co ban
8. Chay them workflow `Post-Deploy Smoke Test` neu server da mo traffic lai

Luu y:

- Rollback app khong dong nghia rollback data
- Neu migration moi da thay doi data, can danh gia rieng truoc khi rollback database
- Khong rollback database chi vi app loi giao dien neu du lieu van con dung

## 9. Rollback database

Chi lam khi:

- loi du lieu nghiem trong
- migration gay hong data
- app rollback khong du giai quyet van de

Trinh tu:

1. Chon ban backup gan nhat con dung
   - uu tien backup co `latest-backup.json` hoac backup manifest ro rang
2. Restore vao DB test truoc
3. Kiem tra:
   - login
   - user
   - batch
   - scan logs
   - work schedules
4. Neu dung moi restore production
5. Sau restore, chay smoke test toi thieu va ghi bien ban su co
6. Ghi lai ro:
   - backup nao da dung
   - ai phe duyet restore
   - mat bao lau
   - co can rotate secret hay force logout user sau su co hay khong

## 10. Sau moi dot release

1. Cap nhat bien ban pilot/go-live
2. Ghi lai loi phat sinh trong 24h dau
3. Tao backlog fix sau release
4. Chot xem ban release nay co du dieu kien mo rong them chi nhanh hay chua
