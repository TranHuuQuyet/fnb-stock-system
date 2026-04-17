# Triển Khai Production

Tài liệu này mô tả cách triển khai hệ thống ở môi trường production dựa trên trạng thái hiện tại của repo. Mục tiêu là giúp bạn có một quy trình go-live thực tế, có kiểm soát, và tránh dùng nhầm cấu hình demo/local cho môi trường thật.

Tài liệu nên được dùng cùng các file sau:

- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [UAT_CHECKLIST.md](./UAT_CHECKLIST.md)
- [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)

## 1. Phạm vi và giả định

- Repo hiện có `docker-compose.yml` để chạy local/demo nhanh.
- Production nên chạy sau reverse proxy có TLS.
- Backend là NestJS, frontend là Next.js, database là PostgreSQL.
- Tài liệu này ưu tiên mô hình `Linux server + PostgreSQL + systemd + reverse proxy`.
- Repo hiện đã có bộ file riêng cho container production; không dùng nguyên xi `docker-compose.yml` hiện tại.

## 2. Những việc bắt buộc trước khi go-live

### Blocker hiện tại trong repo

1. `docker-compose.yml` và `backend/Dockerfile` đang phục vụ demo:
   - backend tự chạy `db:seed`
   - secret trong compose là giá trị mẫu
   - frontend/backend còn mặc định `localhost`
   - nếu dùng container production, phải dùng `docker-compose.prod.yml`, `backend/Dockerfile.prod`, `frontend/Dockerfile.prod`
2. Repo đã có `bootstrap:admin` riêng; production cần dùng script này thay cho `db:seed` và chốt sẵn người giữ credential bootstrap.
3. Frontend production đã dùng `HttpOnly cookie`; nếu còn lưu state trong `localStorage` thì chỉ nên giữ UI/session metadata, không được lưu JWT.
4. Repo đã có runbook backup/restore và rollback; monitoring/alerting vẫn cần được triển khai hoặc nối vào công cụ vận hành thật.

### Checklist bắt buộc

1. Tạo domain hoặc subdomain thật:
   - ví dụ `fnbstore.store` cho frontend
   - hoặc `api.example.com` cho backend nếu không đi chung domain
2. Tạo secret mạnh cho:
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
3. Chuẩn bị PostgreSQL production với storage bền vững và lịch backup.
4. Tắt hoàn toàn seed demo khỏi luồng khởi động production.
5. Chuẩn bị cách tạo tài khoản admin đầu tiên ngoài `db:seed`.
6. Cấu hình HTTPS trước khi cho user thật truy cập.
7. Thiết lập monitoring tối thiểu cho API, database, disk và backup job.
8. Tách rõ staging và production:
   - `staging.fnbstore.store` cho staging/UAT/pilot
   - `fnbstore.store` cho production
9. Không để backup chỉ nằm trên cùng disk với app; nên đẩy backup ra storage riêng hoặc object storage.
10. Chốt sẵn kênh nhận cảnh báo cho readiness fail, database down, disk cao và backup fail.

## 3. Kiến trúc production khuyến nghị

```text
Internet
   |
Reverse Proxy (Nginx / Caddy / Traefik, TLS)
   |-- /        -> Frontend Next.js (127.0.0.1:3000)
   |-- /api/    -> Backend NestJS (127.0.0.1:4000)
   |
PostgreSQL (managed service hoặc máy riêng / volume riêng)
```

Khuyến nghị:

- Ưu tiên chạy frontend và backend sau cùng một reverse proxy.
- Nếu có thể, dùng chung domain để giảm độ phức tạp của CORS.
- Chỉ expose reverse proxy ra Internet; backend và frontend process nên bind nội bộ.

## 4. Biến môi trường production

### Backend

Tạo file `backend/.env.production`:

```dotenv
PORT=4000
DATABASE_URL=postgresql://fnb_user:strong-password@db-host:5432/fnb_stock?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=replace-with-another-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://fnbstore.store
APP_TIMEZONE=Asia/Ho_Chi_Minh
TRUST_PROXY=1
ENABLE_SWAGGER=false
ENABLE_LOGIN_RATE_LIMIT=true
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_MS=600000
REQUIRE_STRONG_SECRETS=true
AUTH_COOKIE_NAME=fnb_stock_session
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
```

Ghi chú:

- `CORS_ORIGIN` hỗ trợ nhiều origin bằng dấu phẩy, nhưng production nên giữ ít nhất có thể.
- `JWT_EXPIRES_IN` và `JWT_REFRESH_EXPIRES_IN` cần theo policy của bạn. Repo hiện có refresh config nhưng chưa có luồng refresh token hoàn chỉnh ở frontend.
- `TRUST_PROXY=1` là cần thiết nếu backend đứng sau reverse proxy.
- `ENABLE_SWAGGER=false` để không public `api/docs` ra Internet ở production.
- `REQUIRE_STRONG_SECRETS=true` để app fail fast nếu secret còn yếu hoặc đang là placeholder.
- `LOGIN_RATE_LIMIT_*` giới hạn số lần gọi `POST /auth/login` theo IP để giảm brute-force.
- Web app production hiện dùng `HttpOnly cookie` cho phiên đăng nhập; frontend không còn giữ access token trong `localStorage`.
- `AUTH_COOKIE_SECURE=true` là bắt buộc khi chạy HTTPS public.

### Frontend

Tạo file `frontend/.env.production`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api/v1
```

Ghi chú:

- Khuyen nghi dung `/api/v1` de frontend image co the tai su dung giua staging va production khi reverse proxy cung host.
- Neu tach backend rieng domain, vi du `https://api.example.com/api/v1`, hay cap nhat `CORS_ORIGIN` tuong ung o backend.

### Compose env cho production

Repo có sẵn file `.env.production.compose.example` để phục vụ `docker-compose.prod.yml`:

```dotenv
COMPOSE_PROJECT_NAME=fnbstore
APP_DOMAIN=fnbstore.store
LETSENCRYPT_EMAIL=ops@fnbstore.store
NEXT_PUBLIC_API_BASE_URL=/api/v1
BACKEND_ENV_FILE=backend/.env.production
FRONTEND_ENV_FILE=frontend/.env.production
```

Ghi chú:

- `APP_DOMAIN` là domain public của hệ thống.
- `NEXT_PUBLIC_API_BASE_URL=/api/v1` là lựa chọn khuyến nghị khi frontend và backend cùng đi qua một domain public.
- `BACKEND_ENV_FILE` và `FRONTEND_ENV_FILE` cho phép bạn đổi sang file env khác nếu muốn dùng staging hoặc file secret riêng.

### Ops env cho backup, alerting và release gate

Tạo file `deploy/.env.ops`:

```dotenv
ALERT_WEBHOOK_URL=
ALERT_WEBHOOK_HEADERS_JSON=
ALERT_NOTIFY_ON_SUCCESS=false
BACKUP_ROOT_DIR=E:\fnb-backups
BACKUP_MIRROR_DIR=
BACKUP_DAILY_RETENTION=14
BACKUP_WEEKLY_RETENTION=8
BACKUP_MONTHLY_RETENTION=3
BACKUP_WEEKLY_DAY=Sunday
BACKUP_MINIMUM_SIZE_BYTES=10240
STAGING_BASE_URL=https://staging.fnbstore.store
STAGING_BACKUP_MANIFEST_PATH=E:\fnb-backups\staging\latest-backup.json
STAGING_BACKUP_MAX_AGE_HOURS=168
STAGING_SMOKE_ADMIN_USERNAME=
STAGING_SMOKE_ADMIN_PASSWORD=
PRODUCTION_BASE_URL=https://fnbstore.store
PRODUCTION_BACKUP_MANIFEST_PATH=E:\fnb-backups\production\latest-backup.json
PRODUCTION_BACKUP_MAX_AGE_HOURS=36
PRODUCTION_SMOKE_ADMIN_USERNAME=
PRODUCTION_SMOKE_ADMIN_PASSWORD=
```

Ghi chú:

- File này không commit vào git; dùng để cấu hình backup job, alert webhook và release gate.
- `BACKUP_MIRROR_DIR` nên trỏ tới NAS, ổ mount, hoặc storage khác máy app nếu có.
- `PRODUCTION_SMOKE_ADMIN_*` nên là tài khoản admin riêng cho smoke test, không dùng tài khoản cá nhân.

## 4.1. Bộ file container production có sẵn

Repo hiện đã có sẵn:

- `docker-compose.prod.yml`
- `backend/Dockerfile.prod`
- `frontend/Dockerfile.prod`
- `deploy/caddy/Caddyfile`
- `.env.production.compose.example`
- `deploy/.env.ops.example`

Luồng này phù hợp khi bạn muốn chạy:

- `1 VPS`
- frontend/backend bằng container
- PostgreSQL managed bên ngoài
- cùng 1 domain `https://fnbstore.store`

### Cách dùng nhanh

1. Copy file env:

```bash
cp .env.production.compose.example .env.production.compose
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production
cp deploy/.env.ops.example deploy/.env.ops
```

Hoặc chạy nhanh:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/init-production.ps1
```

2. Điền giá trị production thật vào 4 file trên.
3. Đảm bảo DNS của `fnbstore.store` đã trỏ về VPS và port `80/443` mở ra Internet.
4. Chạy:

```bash
docker compose --env-file .env.production.compose -f docker-compose.prod.yml up -d --build
```

5. Kiểm tra:
   - `docker compose --env-file .env.production.compose -f docker-compose.prod.yml ps`
   - `https://fnbstore.store`
   - `https://fnbstore.store/api/v1/health`

Ghi chú:

- `caddy` trong compose sẽ nhận TLS tự động nếu domain và port public đúng.
- Compose production này không tạo container PostgreSQL vì hướng triển khai đã chốt là `PostgreSQL managed`.
- Backend container production không chạy `db:seed`.
- Compose production hiện tách riêng service `migrate` để chạy `prisma migrate deploy` trước, rồi backend mới start app.
- Service `migrate` sẽ chạy xong rồi thoát; backend runtime không còn tự migrate lúc boot nên restart và rollback an toàn hơn.
- Frontend production dùng `Next.js standalone`, còn backend runtime đã prune dev dependencies và chạy non-root.

## 5. Chuẩn bị máy chủ

Khuyến nghị tối thiểu:

- Ubuntu 22.04 LTS hoặc tương đương
- 2 vCPU
- 4 GB RAM
- 40 GB SSD trở lên
- Node.js 20 LTS
- npm 10+
- PostgreSQL 16
- Nginx hoặc Caddy

Nguyên tắc phân quyền:

- Tạo user chạy dịch vụ riêng, ví dụ `fnb`.
- Không chạy frontend/backend dưới `root`.
- Chỉ reverse proxy mở cổng `80/443`.
- Backend và frontend chỉ bind `127.0.0.1`.

## 6. Quy trình build và deploy

### Bước 1: copy mã nguồn

```bash
sudo mkdir -p /srv/fnb-stock-system
sudo chown -R $USER:$USER /srv/fnb-stock-system
git clone <repo-url> /srv/fnb-stock-system
cd /srv/fnb-stock-system
```

### Bước 2: cài dependencies

```bash
cd /srv/fnb-stock-system/backend
npm ci

cd /srv/fnb-stock-system/frontend
npm ci
```

### Bước 3: tạo env production

```bash
cp /srv/fnb-stock-system/backend/.env.production.example /srv/fnb-stock-system/backend/.env.production
cp /srv/fnb-stock-system/frontend/.env.production.example /srv/fnb-stock-system/frontend/.env.production
cp /srv/fnb-stock-system/deploy/.env.ops.example /srv/fnb-stock-system/deploy/.env.ops
```

Sau đó thay toàn bộ giá trị demo bằng giá trị production thật.

### Bước 4: migrate database

```bash
cd /srv/fnb-stock-system/backend
set -a
source .env.production
set +a
npm run prisma:generate
npm run prisma:deploy
```

Lưu ý:

- Không chạy `npm run db:seed` trên production.
- Nếu chưa có bootstrap admin production-safe, hãy hoàn tất bước này trước khi mở hệ thống cho user thật.

### Bước 4.1: bootstrap admin đầu tiên

Lệnh này dùng để tạo admin đầu tiên cho production mà không kéo theo dữ liệu demo:

```bash
cd /srv/fnb-stock-system/backend
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_FULL_NAME="FNB Store Admin" \
BOOTSTRAP_ADMIN_PASSWORD='replace-with-a-strong-password' \
BOOTSTRAP_ADMIN_FORCE_RESET=true \
npm run bootstrap:admin
```

Nếu muốn tạo luôn chi nhánh đầu tiên:

```bash
cd /srv/fnb-stock-system/backend
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_FULL_NAME="FNB Store Admin" \
BOOTSTRAP_ADMIN_PASSWORD='replace-with-a-strong-password' \
BOOTSTRAP_ADMIN_FORCE_RESET=true \
BOOTSTRAP_STORE_CODE=CN01 \
BOOTSTRAP_STORE_NAME="Chi nhánh 1" \
BOOTSTRAP_STORE_TIMEZONE=Asia/Ho_Chi_Minh \
npm run bootstrap:admin
```

Ghi chú:

- Script này chỉ tạo tối thiểu `AppConfig`, admin đầu tiên, và tùy chọn 1 store.
- Không dùng script này để nạp dữ liệu demo.
- Không chạy lặp lại với cùng `username`.

### Bước 5: build backend và frontend

```bash
cd /srv/fnb-stock-system/backend
set -a
source .env.production
set +a
npm run build

cd /srv/fnb-stock-system/frontend
set -a
source .env.production
set +a
npm run build
```

### Bước 6: tạo service cho backend

Tạo file `/etc/systemd/system/fnb-stock-backend.service`:

```ini
[Unit]
Description=FNB Stock Backend
After=network.target

[Service]
Type=simple
User=fnb
Group=fnb
WorkingDirectory=/srv/fnb-stock-system/backend
Environment=NODE_ENV=production
EnvironmentFile=/srv/fnb-stock-system/backend/.env.production
ExecStart=/usr/bin/env npm run start:prod
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Bước 7: tạo service cho frontend

Tạo file `/etc/systemd/system/fnb-stock-frontend.service`:

```ini
[Unit]
Description=FNB Stock Frontend
After=network.target

[Service]
Type=simple
User=fnb
Group=fnb
WorkingDirectory=/srv/fnb-stock-system/frontend
Environment=NODE_ENV=production
EnvironmentFile=/srv/fnb-stock-system/frontend/.env.production
ExecStart=/usr/bin/env npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Bước 8: bật service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fnb-stock-backend
sudo systemctl enable --now fnb-stock-frontend
```

### Bước 9: kiểm tra service

```bash
sudo systemctl status fnb-stock-backend
sudo systemctl status fnb-stock-frontend
curl http://127.0.0.1:4000/api/v1/health
curl http://127.0.0.1:4000/api/v1/health/ready
curl -I http://127.0.0.1:3000
```

## 7. Cấu hình reverse proxy

### Mẫu Nginx

```nginx
server {
    listen 80;
    server_name fnb.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fnb.example.com;

    ssl_certificate /etc/letsencrypt/live/fnb.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fnb.example.com/privkey.pem;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Sau khi tạo file cấu hình:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Tạo admin đầu tiên

Repo hiện đã có luồng `bootstrap:admin` riêng cho production.

Khuyến nghị:

1. Chạy bootstrap đúng 1 lần trên database trống hoặc môi trường mới.
2. Dùng mật khẩu mạnh và đặt `BOOTSTRAP_ADMIN_FORCE_RESET=true`.
3. Đăng nhập admin vừa tạo, đổi mật khẩu, rồi lưu credential bootstrap theo runbook nội bộ.
4. Không dùng `db:seed` cho production vì seed vẫn phục vụ local/demo.

## 9. Smoke test sau deploy

Thực hiện toàn bộ trước khi mở cho người dùng thật:

1. Mở frontend production và đăng nhập bằng tài khoản admin bootstrap.
2. Kiểm tra `GET /api/v1/health` và `GET /api/v1/health/ready` đều trả `ok/ready`.
3. Tạo chi nhánh, user, ingredient unit, ingredient group, ingredient.
4. Tạo batch, in tem, quét online.
5. Thử offline queue rồi bật mạng lại để sync.
6. Mở `Control > Kho nguyên liệu` và xác nhận số liệu cập nhật đúng.
7. Mở `Control > Ca làm việc`, lưu tháng hiện tại, nhập thử `phụ cấp / đi trễ / về sớm`, rồi thử `In bảng lương` hoặc `Xuất Excel`.
8. Cấu hình `IP whitelist`, thử `Lấy IP hiện tại`, kiểm tra `scan/network-status`.
9. Thử bật `Emergency bypass` có thời hạn cho một chi nhánh test.
10. Kiểm tra dashboard, reconciliation, anomaly alerts, audit logs.

## 10. Backup và restore

### Backup tối thiểu

- Backup PostgreSQL hằng ngày.
- Giữ ít nhất:
  - 14 bản daily
  - 8 bản weekly
  - 3 bản monthly
- Mã hóa backup nếu lưu ngoài máy chủ.

### Ví dụ backup

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-backup-job.ps1 -Environment production
```

### Ví dụ restore

```bash
createdb fnb_stock_restore
pg_restore -d fnb_stock_restore /backups/fnb_stock_2026-04-14.dump
```

Khuyến nghị:

- Test restore định kỳ trên môi trường staging hoặc máy phục hồi riêng.
- Không coi backup là hoàn thành nếu chưa test restore.
- Xem runbook chi tiết tại [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).
- Trước khi mở thật cho người dùng, chạy lần lượt [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md), [UAT_CHECKLIST.md](./UAT_CHECKLIST.md), rồi [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md).

## 11. Monitoring và log

Tối thiểu nên có:

- API health check mỗi 1 phút
- alert khi `health/ready` lỗi
- alert khi disk gần đầy
- alert khi backup job thất bại
- log rotation cho `journalctl` hoặc agent log tập trung

Nên theo dõi thêm:

- scan reject do network policy
- fraud attempts
- sync offline thất bại
- import POS lỗi
- tăng trưởng bất thường của `ScanLog`, `AuditLog`

### 11.1 Gợi ý triển khai tối thiểu

Nếu chưa muốn dựng một stack observability lớn ngay từ đầu, có thể bắt đầu bằng:

1. Một job check URL cho `https://fnbstore.store/api/v1/health`
2. Một job check URL cho `https://fnbstore.store/api/v1/health/ready`
3. Một alert disk cho server app và server backup
4. Một alert backup job khi không tạo được file mới hoặc `latest-backup.json`
5. Một kênh alert chung mà đội vận hành thật sự đọc được, ví dụ email, Slack hoặc Telegram

Script hỗ trợ sẵn trong repo:

- `deploy/scripts/send-ops-alert.ps1`: đẩy alert ra webhook chung
- `deploy/scripts/run-backup-job.ps1`: backup có retention theo tier, manifest và mirror off-host nếu cấu hình
- `deploy/scripts/run-release-gate.ps1`: chạy preflight + kiểm tra backup manifest + smoke test theo đúng môi trường

Lưu ý:

- Không dựa hoàn toàn vào review log thủ công.
- Readiness fail và backup fail nên là alert bắt buộc trước go-live.
- Nếu có điều kiện, tách backup sang storage khác máy chủ app.

## 12. Rollback

### Khi deploy ứng dụng lỗi

1. Dừng rollout.
2. Rollback sang commit/tag ổn định gần nhất.
3. Build lại backend/frontend từ commit cũ.
4. Restart service.
5. Chạy lại smoke test tối thiểu.

Lệnh khuyến nghị:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment production -RequireAuth
```

### Khi migration gây lỗi

1. Dừng backend trước để tránh ghi tiếp.
2. Khôi phục database từ bản backup gần nhất nếu migration không thể rollback an toàn.
3. Chỉ mở lại traffic sau khi smoke test lại thành công.

## 13. Những cải tiến nên làm tiếp

Các hạng mục sau không chặn việc viết tài liệu, nhưng rất nên hoàn tất trước khi go-live rộng:

1. Tách hẳn `docker-compose.prod.yml` hoặc manifest production riêng.
2. Tách `seed demo` và `bootstrap admin` thành hai luồng khác nhau.
3. Rà soát các màn hình cũ để không còn phụ thuộc vào token trong `localStorage`.
4. Thêm brute-force protection và password reset an toàn hơn.
5. Thêm CI/CD với smoke test sau deploy.
6. Thêm runbook rotation secret, certificate renewal và lịch test restore.

## 14. Tóm tắt khuyến nghị triển khai

Nếu cần đi nhanh nhưng vẫn an toàn tương đối:

1. Không dùng `docker-compose.yml` hiện tại cho production.
2. Dùng PostgreSQL riêng có backup.
3. Chạy backend/frontend bằng systemd sau reverse proxy TLS.
4. Bỏ seed demo khỏi startup.
5. Chuẩn bị bootstrap admin riêng.
6. Chỉ go-live sau khi hoàn thành smoke test và test restore.
