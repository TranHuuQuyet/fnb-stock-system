# Go-Live Checklist

Tai lieu nay dung cho ngay mo he thong thuc te tai `fnbstore.store`. Nen chay theo dung thu tu de giam rui ro khi trien khai cho 2 chi nhanh dau tien. Neu can chot tag release, image tag hoac rollback chi tiet, xem them [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md). Neu dang chay thu 2 chi nhanh dau tien, xem them [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md). Trang thai rollout hien tai nen duoc ghi song song tai [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md).

## 1. Quyet dinh da chot

- He thong dung noi bo cho chuoi cua hang
- Giai doan dau trien khai cho `2` chi nhanh
- Frontend va backend di cung 1 domain: `https://fnbstore.store`
- API production: `https://fnbstore.store/api/v1`
- Ha tang khuyen nghi: `1 VPS chay app + PostgreSQL managed`
- Chuyen kho theo flow:
  - chi nhanh A gui hang
  - hang vao trang thai `IN_TRANSIT`
  - chi nhanh B xac nhan nhan
  - chi khi do kho B moi tang
- Offline chi ap dung cho `Su dung tai quan`
- Chinh sach backup:
  - `14` ban daily
  - `8` ban weekly
  - `3` ban monthly
- Staging phai tach khoi production:
  - `staging.fnbstore.store` cho staging/UAT/pilot
  - `fnbstore.store` cho production

## 2. Truoc ngay go-live 3 den 7 ngay

1. Hoan thanh [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
2. Hoan thanh [UAT_CHECKLIST.md](./UAT_CHECKLIST.md)
3. Chot branch hoac tag se deploy production theo [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)
4. Chot danh sach user dau tien:
   - `ADMIN`
   - `MANAGER` tung chi nhanh
   - `STAFF` tung chi nhanh
5. Chot danh muc ban dau:
   - store
   - ingredient unit
   - ingredient group
   - ingredient
6. Chuan bi danh sach IP whitelist cua tung chi nhanh
7. In thu tem tren kho giay hoac may in thuc te
8. Kiem tra thiet bi dung de scan o 2 chi nhanh
9. Chuan bi huong dan van hanh ngan cho quan ly va nhan vien

## 3. Truoc gio go-live

1. Xac nhan backup production dang hoat dong
2. Chay them 1 ban backup thu cong truoc deploy
   - luu lai `backup manifest` hoac duong dan file backup vua tao
3. Kiem tra dung luong dia va trang thai database
4. Kiem tra domain `fnbstore.store` va chung chi TLS
5. Kiem tra env production:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN=https://fnbstore.store`
   - `NEXT_PUBLIC_API_BASE_URL=/api/v1`
   - `ENABLE_SWAGGER=false`
   - `TRUST_PROXY=1`
   - `REQUIRE_STRONG_SECRETS=true`
   - `AUTH_COOKIE_SECURE=true`
   - `AUTH_COOKIE_SAME_SITE=lax`
   - `deploy/.env.ops` da duoc dien cho backup, alerting va smoke admin
   - neu dung Neon/PgBouncer/pooler, `DIRECT_URL` phai la direct connection string va khong duoc tro vao host pooler
   - backup/restore admin tooling nen dung `DIRECT_URL`, khong dung pooled URL
6. Chay preflight check:
   - lenh PowerShell duoi day danh cho may operator; tren VPS Linux uu tien `./ops.sh`
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment production`
7. Khuyen nghi chay gate day du:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment production -RequireAuth`
8. Xac nhan production khong chay `db:seed`
9. Xac nhan da co lenh `bootstrap:admin` hoac da hoan tat bootstrap admin dau tien va doi mat khau
10. Xac nhan backup job luu ra storage ngoai app disk va co `latest-backup.json`
11. Xac nhan da co kenh alert cho readiness fail, database down, disk cao va backup fail

## 4. Cac buoc go-live

1. Bat maintenance window noi bo neu can
2. Pull dung branch hoac tag da chot
3. Chay:
   - `cd backend && npm run prisma:generate`
   - `cd backend && npm run prisma:deploy`
4. Chi chay `bootstrap:admin` neu la database production moi hoan toan va chua co admin
   - neu admin dau tien da duoc tao va da doi mat khau, cap nhat `DEPLOYMENT_STATUS.md` va bo qua buoc nay
5. Build backend va frontend
6. Restart service backend va frontend
7. Kiem tra reverse proxy
8. Kiem tra:
   - `GET /api/v1/health`
   - `GET /api/v1/health/ready`
9. Chay script smoke test nhanh:
   - neu chay tu may operator co PowerShell:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://fnbstore.store`
10. Chay workflow GitHub Actions `Post-Deploy Smoke Test` cho `production` voi `require_auth=true`

## 5. Smoke test bat buoc ngay sau deploy

1. Dang nhap bang admin
2. Tao hoac kiem tra store, user, ingredient unit, ingredient group, ingredient
3. Tao 1 batch test va in tem
4. Quet 1 luot `Su dung tai quan`
5. Thu scan offline roi sync lai
6. Tao 1 phieu `Chuyen kho` tu chi nhanh A sang B
7. Dang nhap manager hoac admin o chi nhanh B de xac nhan nhan
8. Mo `Control > Kho nguyen lieu` va kiem tra so lieu
9. Mo `Control > Ca lam viec`, nhap thu phu cap va di tre hoac ve som
10. Thu `In bang luong` hoac `Xuat Excel`
11. Mo `Admin > Reports`
12. Kiem tra `IP whitelist`, `scan/network-status`, `Emergency bypass`

## 6. Trong 24 gio dau

1. Theo doi:
   - login that bai
   - scan reject
   - sync offline loi
   - chuyen kho cho xac nhan qua lau
   - loi mo bang luong hoac export Excel
2. Kiem tra dinh ky:
   - dashboard
   - scan logs
   - kho nguyen lieu
   - admin reports
3. Ghi lai tat ca loi phat sinh va workaround

## 7. Quy trinh du phong khi co su co

### Khi mat mang tai chi nhanh

1. Tiep tuc dung che do `Su dung tai quan` tren thiet bi da dang nhap
2. Khong thuc hien `Chuyen kho` trong luc offline
3. Khi co mang lai, mo man scan de he thong tu sync
4. Quan ly chi nhanh kiem tra lai `Scan Logs`

### Khi backend production loi

1. Tam dung thao tac quan tri moi
2. Giu lai bang chung loi:
   - thoi diem xay ra
   - man hinh loi
   - user bi anh huong
3. Nguoi phu trach ky thuat kiem tra:
   - `health/ready`
   - log backend
   - trang thai database
4. Neu loi do ban deploy moi:
   - rollback ung dung ve ban on dinh gan nhat
   - chay lai smoke test toi thieu
5. Neu nghi ngo loi du lieu:
   - restore vao database test truoc
   - chi restore production sau khi xac nhan du lieu dung

## 8. Dieu kien rollback

Rollback nen duoc thuc hien neu xay ra mot trong cac tinh huong sau:

1. User khong dang nhap duoc hang loat
2. Scan thanh cong nhung so lieu ton kho sai ro rang
3. Chuyen kho khong tao duoc hoac xac nhan nhan lam lech kho
4. Bang luong tinh sai hang loat
5. He thong loi lien tuc trong gio van hanh ma khong co workaround an toan

## 9. Chot sau go-live

1. Xac nhan backup dem dau tien chay thanh cong
2. Xac nhan file `latest-backup.json` hoac metadata backup duoc cap nhat dung
3. Ghi lai cac loi ngay dau va muc do anh huong
4. Chot danh sach cai tien sau pilot
5. Chi mo rong them chi nhanh khi 2 chi nhanh dau da van hanh on dinh
