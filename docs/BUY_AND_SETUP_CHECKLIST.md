# Buy And Setup Checklist

Tai lieu nay dung cho giai doan ban da co domain, nhung chua co VPS, chua co database staging, va can mot checklist theo tung buoc de di tu `moi mua domain` den `san sang deploy staging`.

Nen dung kem:

- [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md)
- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)
- [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md)

## 1. Mua gi

### 1.1 Bat buoc

1. `1 VPS` de chay app
2. `1 PostgreSQL managed` cho staging
3. Domain da co:
   - `fnbstore.store`
   - se dung them `staging.fnbstore.store`

### 1.2 Cau hinh toi thieu nen mua

Cho giai doan staging va pilot nho:

- `2 vCPU`
- `4 GB RAM`
- `40 GB SSD`
- Ubuntu `22.04 LTS`

Neu muon du gia hon cho production sau nay:

- `4 vCPU`
- `8 GB RAM`
- `80 GB SSD`

### 1.3 Goi y mua database

Muc tieu hien tai:

- tao `1 database staging` rieng
- khong dung chung voi production
- co san backup
- lay duoc `DATABASE_URL`

Chi can dung staging truoc. Production tao sau khi staging on.

## 2. Nhung thong tin can co truoc khi dung staging

Ban can chot cac gia tri sau:

### Ha tang

- IP cua VPS
- user SSH de dang nhap VPS
- domain staging: `staging.fnbstore.store`

### Database staging

- `DB host`
- `DB port`
- `DB name`
- `DB user`
- `DB password`
- `DATABASE_URL`

### Email

- `LETSENCRYPT_EMAIL`

## 3. DNS can lam

Sau khi co VPS:

1. Tao ban ghi `A` cho:
   - `fnbstore.store`
   - `staging.fnbstore.store`
2. Tro ca 2 ve IP cua VPS
3. Cho DNS cap nhat
4. Kiem tra domain da ve dung IP

## 4. Checklist cau hinh VPS

### 4.1 Dang nhap va cap nhat may

```bash
ssh <your-user>@<your-vps-ip>
sudo apt update
sudo apt upgrade -y
```

### 4.2 Cai Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

### 4.3 Tao thu muc deploy

```bash
sudo mkdir -p /srv/fnb-stock-system
sudo chown -R $USER:$USER /srv/fnb-stock-system
cd /srv/fnb-stock-system
```

### 4.4 Pull code

```bash
git clone <repo-url> /srv/fnb-stock-system
cd /srv/fnb-stock-system
```

## 5. Tao file staging tren may deploy

Ban da co san script trong repo:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/init-staging.ps1
```

Neu dang thao tac tren Linux server, co the tao file thu cong:

```bash
cp .env.staging.compose.example .env.staging.compose
cp backend/.env.staging.example backend/.env.staging
cp frontend/.env.staging.example frontend/.env.staging
```

## 6. Gia tri can dien vao env staging

### `.env.staging.compose`

Ban can xac nhan:

```dotenv
COMPOSE_PROJECT_NAME=fnbstore-staging
APP_DOMAIN=staging.fnbstore.store
LETSENCRYPT_EMAIL=<email-that>
NEXT_PUBLIC_API_BASE_URL=https://staging.fnbstore.store/api/v1
BACKEND_ENV_FILE=backend/.env.staging
FRONTEND_ENV_FILE=frontend/.env.staging
```

### `backend/.env.staging`

Ban can xac nhan:

```dotenv
PORT=4000
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/fnb_stock_staging?schema=public
JWT_SECRET=<secret-that>
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=<refresh-secret-that>
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://staging.fnbstore.store
APP_TIMEZONE=Asia/Ho_Chi_Minh
TRUST_PROXY=1
```

### `frontend/.env.staging`

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://staging.fnbstore.store/api/v1
```

## 7. Preflight check truoc khi deploy

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging
```

Chi duoc deploy khi script nay pass.

## 8. Lenh deploy staging

```bash
docker compose --env-file .env.staging.compose -f docker-compose.prod.yml up -d --build
```

Kiem tra:

```bash
docker compose --env-file .env.staging.compose -f docker-compose.prod.yml ps
```

## 9. Kiem tra staging sau deploy

### Health check

Mo cac URL:

- `https://staging.fnbstore.store`
- `https://staging.fnbstore.store/api/v1/health`
- `https://staging.fnbstore.store/api/v1/health/ready`

### Smoke test nhanh

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://staging.fnbstore.store
```

## 10. Bootstrap admin

Neu database staging moi hoan toan:

```bash
cd /srv/fnb-stock-system/backend
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_FULL_NAME="FNB Store Admin" \
BOOTSTRAP_ADMIN_PASSWORD='DatMatKhauManh1' \
BOOTSTRAP_ADMIN_FORCE_RESET=true \
BOOTSTRAP_STORE_CODE=CN01 \
BOOTSTRAP_STORE_NAME="Chi nhanh 1" \
BOOTSTRAP_STORE_TIMEZONE=Asia/Ho_Chi_Minh \
npm run bootstrap:admin
```

## 11. Sau khi staging len

1. Dang nhap admin
2. Tao chi nhanh thu 2
3. Tao manager/staff test
4. Tao ingredient unit, ingredient group, ingredient
5. Tao batch test
6. In tem
7. Quet online
8. Quet offline roi sync
9. Tao transfer A -> B
10. Xac nhan nhan o B
11. Test ca lam va bao cao admin

## 12. Dieu kien san sang cho pilot

Ban duoc coi la san sang cho pilot khi:

1. Da co VPS
2. Da co database staging
3. DNS staging da dung
4. Staging deploy thanh cong
5. Smoke test pass
6. Bootstrap admin pass
7. UAT cac luong chinh pass
