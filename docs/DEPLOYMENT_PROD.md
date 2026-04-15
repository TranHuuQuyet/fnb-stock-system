# Triển Khai Production

Tài liệu này mô tả cách triển khai hệ thống ở môi trường production dựa trên trạng thái hiện tại của repo. Mục tiêu là giúp bạn có một quy trình go-live thực tế, có kiểm soát, và tránh dùng nhầm cấu hình demo/local cho môi trường thật.

## 1. Phạm vi và giả định

- Repo hiện có `docker-compose.yml` để chạy local/demo nhanh.
- Production nên chạy sau reverse proxy có TLS.
- Backend là NestJS, frontend là Next.js, database là PostgreSQL.
- Tài liệu này ưu tiên mô hình `Linux server + PostgreSQL + systemd + reverse proxy`.
- Nếu bạn muốn dùng container cho production, hãy tạo cấu hình riêng; không dùng nguyên xi `docker-compose.yml` hiện tại.

## 2. Những việc bắt buộc trước khi go-live

### Blocker hiện tại trong repo

1. `docker-compose.yml` và `backend/Dockerfile` đang phục vụ demo:
   - backend tự chạy `db:seed`
   - secret trong compose là giá trị mẫu
   - frontend/backend còn mặc định `localhost`
2. Repo chưa có luồng bootstrap admin production-safe riêng; `db:seed` đang tạo user/demo password mẫu.
3. Frontend hiện lưu access token trong `localStorage`; đây là điểm cần cân nhắc kỹ trước khi public ra Internet.
4. Repo chưa có sẵn runbook backup/restore, monitoring, alerting và rollback cho production.

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
```

Ghi chú:

- `CORS_ORIGIN` hỗ trợ nhiều origin bằng dấu phẩy, nhưng production nên giữ ít nhất có thể.
- `JWT_EXPIRES_IN` và `JWT_REFRESH_EXPIRES_IN` cần theo policy của bạn. Repo hiện có refresh config nhưng chưa có luồng refresh token hoàn chỉnh ở frontend.
- `TRUST_PROXY=1` là cần thiết nếu backend đứng sau reverse proxy.

### Frontend

Tạo file `frontend/.env.production`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://fnbstore.store/api/v1
```

Ghi chú:

- Nếu tách backend riêng domain, ví dụ `https://api.example.com/api/v1`, hãy cập nhật `CORS_ORIGIN` tương ứng ở backend.
- Giá trị `NEXT_PUBLIC_API_BASE_URL` được dùng khi build frontend; phải đúng domain production trước khi chạy `npm run build`.

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

Hiện repo chưa có luồng bootstrap admin riêng cho production. Đây là việc cần xử lý trước khi go-live.

Khuyến nghị:

1. Tạo script bootstrap riêng chỉ để:
   - tạo 1 store gốc nếu cần
   - tạo 1 tài khoản admin đầu tiên
   - không tạo dữ liệu demo khác
2. Chạy script này đúng 1 lần trên database trống.
3. Đăng nhập admin vừa tạo và đổi mật khẩu ngay.
4. Ghi lại tài khoản bootstrap trong runbook nội bộ.

Không khuyến nghị:

- Dùng `db:seed` của repo hiện tại trên production thật, vì seed tạo sẵn user/demo password và dữ liệu mẫu.

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
  - 7 bản daily
  - 4 bản weekly
  - 3 bản monthly
- Mã hóa backup nếu lưu ngoài máy chủ.

### Ví dụ backup

```bash
pg_dump -Fc -d "postgresql://fnb_user:strong-password@db-host:5432/fnb_stock" > /backups/fnb_stock_$(date +%F).dump
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

## 12. Rollback

### Khi deploy ứng dụng lỗi

1. Dừng rollout.
2. Rollback sang commit/tag ổn định gần nhất.
3. Build lại backend/frontend từ commit cũ.
4. Restart service.
5. Chạy lại smoke test tối thiểu.

### Khi migration gây lỗi

1. Dừng backend trước để tránh ghi tiếp.
2. Khôi phục database từ bản backup gần nhất nếu migration không thể rollback an toàn.
3. Chỉ mở lại traffic sau khi smoke test lại thành công.

## 13. Những cải tiến nên làm tiếp

Các hạng mục sau không chặn việc viết tài liệu, nhưng rất nên hoàn tất trước khi go-live rộng:

1. Tách hẳn `docker-compose.prod.yml` hoặc manifest production riêng.
2. Tách `seed demo` và `bootstrap admin` thành hai luồng khác nhau.
3. Chuyển auth từ lưu token trong `localStorage` sang phương án an toàn hơn như `HttpOnly cookie`.
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
