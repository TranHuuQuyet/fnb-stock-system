# Release Runbook

Tai lieu nay dung de chot ban staging, tag release, deploy production va rollback khi can. Muc tieu la de ban co mot quy trinh lap lai duoc cho `fnbstore.store`, thay vi deploy thu cong theo tri nho.

Nen dung kem cac tai lieu sau:

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

## 3. Quy trinh staging

### 3.1 Chuan bi env staging

Repo da co san:

- `.env.staging.compose.example`
- `backend/.env.staging.example`
- `frontend/.env.staging.example`

Copy thanh file that:

```bash
cp .env.staging.compose.example .env.staging.compose
cp backend/.env.staging.example backend/.env.staging
cp frontend/.env.staging.example frontend/.env.staging
```

Sau do dien gia tri staging that:

- `APP_DOMAIN=staging.fnbstore.store`
- `DATABASE_URL` cua DB staging
- secret staging rieng

Neu chua tao file staging that, co the dung script:

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

Co the chay nhanh bang script:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://staging.fnbstore.store
```

Va preflight env truoc khi deploy:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging
```

Neu chua pass, khong duoc tag release.

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

## 5. Truoc khi deploy production

1. Xac nhan tag dung
2. Xac nhan `fnbstore.store` dang tro dung VPS
3. Xac nhan backup production vua duoc tao
4. Xac nhan env production khong dung gia tri staging/demo
5. Xac nhan co ban release truoc do de rollback
6. Chay preflight check:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment production
```

## 6. Trinh tu deploy production

### Neu dung compose production

1. Pull dung tag release
2. Copy hoac cap nhat:
   - `.env.production.compose`
   - `backend/.env.production`
   - `frontend/.env.production`
3. Chay:

```bash
docker compose --env-file .env.production.compose -f docker-compose.prod.yml pull
docker compose --env-file .env.production.compose -f docker-compose.prod.yml up -d --build
```

4. Kiem tra:
   - `docker compose ... ps`
   - `https://fnbstore.store`
   - `https://fnbstore.store/api/v1/health`
   - `https://fnbstore.store/api/v1/health/ready`
5. Chay smoke test bat buoc theo [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
6. Chay them script smoke test nhanh:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://fnbstore.store
```

### Neu dung image tu GHCR

Can ghi ro tag image da deploy:

- `ghcr.io/tranhuuquyet/fnb-stock-backend:<tag-or-sha>`
- `ghcr.io/tranhuuquyet/fnb-stock-frontend:<tag-or-sha>`

## 7. Bien ban release toi thieu

Moi dot deploy nen luu lai:

- release tag
- commit SHA
- migration moi
- backup id hoac timestamp truoc deploy
- ket qua smoke test
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
3. Checkout lai tag hoac doi image ve ban cu
4. Redeploy app
5. Chay smoke test toi thieu:
   - login admin
   - health/ready
   - scan co ban
   - transfer co ban

Luu y:

- Rollback app khong dong nghia rollback data
- Neu migration moi da thay doi data, can danh gia rieng truoc khi rollback database

## 9. Rollback database

Chi lam khi:

- loi du lieu nghiem trong
- migration gay hong data
- app rollback khong du giai quyet van de

Trinh tu:

1. Chon ban backup gan nhat con dung
2. Restore vao DB test truoc
3. Kiem tra:
   - login
   - user
   - batch
   - scan logs
   - work schedules
4. Neu dung moi restore production
5. Sau restore, chay smoke test toi thieu va ghi bien ban su co

## 10. Sau moi dot release

1. Cap nhat bien ban pilot/go-live
2. Ghi lai loi phat sinh trong 24h dau
3. Tao backlog fix sau release
4. Chot xem ban release nay co du dieu kien mo rong them chi nhanh hay chua
