# Vận Hành VPS

Tài liệu này là runbook thực chiến cho production hiện tại. Mục tiêu là để mỗi lần bạn mở terminal hoặc SSH vào VPS, bạn có thể copy-paste lệnh để kiểm tra, bật app, dừng app, deploy lại sau khi fix lỗi và rollback khi cần.

Phạm vi tài liệu này:

- Server hiện tại chạy app ở `/opt/fnb-stock-system`
- Domain public hiện tại là `https://fnbstore.store`
- App chạy bằng `docker compose` với `.env.production.compose` và `docker-compose.prod.yml`
- Luồng deploy chuẩn là `local sửa code -> push GitHub -> VPS git pull -> rebuild`

Không dùng tài liệu này cho local/demo. Không dùng `docker-compose.yml` local để chạy production.

## 1. Chuẩn Bị Một Lần Trên VPS

SSH vào VPS:

```bash
ssh root@103.165.144.144
cd /opt/fnb-stock-system
chmod +x ops.sh deploy/scripts/prod-ops.sh
```

Nếu `./ops.sh` báo `No such file or directory`, checkout trên VPS đang cũ hơn commit thêm file wrapper này. Khi đó chạy:

```bash
cd /opt/fnb-stock-system
git status --short
git pull
chmod +x ops.sh deploy/scripts/prod-ops.sh
./ops.sh status
```

Nếu cần thao tác ngay trước khi `git pull`, gọi script thật trực tiếp:

```bash
cd /opt/fnb-stock-system
./deploy/scripts/prod-ops.sh status
```

Từ lần sau chỉ cần:

```bash
ssh root@103.165.144.144
cd /opt/fnb-stock-system
```

## 2. Luồng Nhanh Mỗi Khi Vừa SSH Vào

Kiểm tra app đang chạy hay không:

```bash
cd /opt/fnb-stock-system
./ops.sh status
```

Nếu app đang ổn, bạn sẽ thấy:

- `backend`, `frontend`, `caddy` là `Up`
- `migrate` có thể là `Exited (0)` và đây là bình thường
- `https://fnbstore.store` trả `HTTP 200`
- `https://fnbstore.store/api/v1/health` trả `status=ok`

Nếu app chưa lên hoặc đang tắt:

```bash
./ops.sh up
./ops.sh status
```

## 3. Bộ Lệnh Dùng Hằng Ngày

```bash
cd /opt/fnb-stock-system
./ops.sh status
./ops.sh ps
./ops.sh health
./ops.sh up
./ops.sh rebuild
./ops.sh restart
./ops.sh stop
./ops.sh down
./ops.sh logs backend 200
./ops.sh logs frontend 200
./ops.sh logs caddy 200
./ops.sh logs migrate 200
./ops.sh follow backend
./ops.sh migrate
```

Ý nghĩa nhanh:

- `./ops.sh up`: bật app bằng image hiện có
- `./ops.sh rebuild`: build lại image và bật app
- `./ops.sh restart`: restart container, không build lại
- `./ops.sh stop`: dừng container nhưng không xóa
- `./ops.sh down`: dừng và xóa stack compose
- `./ops.sh migrate`: chạy riêng job `prisma migrate deploy`
- `./ops.sh status`: xem `docker compose ps` và health public

## 4. Khi Nào Dùng `up`, `restart`, `rebuild`, `stop`, `down`

Dùng `up` khi:

- app đang tắt
- container đã có sẵn và bạn chỉ muốn bật lại nhanh

```bash
./ops.sh up
```

Dùng `restart` khi:

- app đang chạy nhưng bạn muốn restart nhanh
- không có thay đổi code, không đổi env, không đổi Dockerfile

```bash
./ops.sh restart
```

Dùng `rebuild` khi:

- bạn vừa `git pull` code mới trên VPS
- bạn vừa sửa `.env.production.compose`
- bạn vừa sửa `backend/.env.production` hoặc `frontend/.env.production`
- bạn vừa thay đổi Dockerfile hoặc dependency

```bash
./ops.sh rebuild
```

Dùng `stop` khi:

- bạn muốn dừng app tạm thời để bảo trì ngắn
- bạn chưa muốn xóa stack

```bash
./ops.sh stop
```

Dùng `down` khi:

- bạn muốn tắt hẳn stack compose
- bạn chấp nhận container bị remove và sẽ bật lại sau bằng `./ops.sh up`

```bash
./ops.sh down
```

## 5. Cách Xem Log Và Kiểm Tra Health

Xem nhanh log backend:

```bash
./ops.sh logs backend 200
```

Xem nhanh log frontend:

```bash
./ops.sh logs frontend 200
```

Xem nhanh log reverse proxy:

```bash
./ops.sh logs caddy 200
```

Xem log migrate khi database hoặc migration có vấn đề:

```bash
./ops.sh logs migrate 200
```

Theo dõi log realtime:

```bash
./ops.sh follow backend
./ops.sh follow frontend
./ops.sh follow caddy
```

Kiểm tra health public:

```bash
./ops.sh health
```

Kiểm tra riêng bằng `curl`:

```bash
curl -I https://fnbstore.store
curl https://fnbstore.store/api/v1/health
curl https://fnbstore.store/api/v1/health/ready
```

## 6. Deploy Lại Sau Khi Sửa Code Ở Máy Local

Đây là luồng chuẩn cần dùng.

### 6.1. Ở máy local

Sửa code, test local nếu cần, sau đó:

```bash
git status
git add .
git commit -m "Fix chuc nang A"
git push origin main
```

Nếu bạn deploy từ branch khác, thay `main` bằng branch thật.

### 6.2. Trên VPS

SSH vào VPS rồi chạy:

```bash
cd /opt/fnb-stock-system
git status --short
git pull --ff-only origin main
./ops.sh rebuild
./ops.sh status
```

Nếu `git status --short` trả ra file thay đổi trên VPS, dừng lại và kiểm tra trước khi `git pull`. Không nên chồng thay đổi thủ công trên production.

### 6.3. Kiểm tra sau deploy

```bash
./ops.sh health
./ops.sh logs backend 100
./ops.sh logs frontend 100
```

Sau đó mở trình duyệt và test lại đúng chức năng vừa sửa.

## 7. Nếu Bản Fix Có Thay Đổi Database Hoặc Migration

Nếu commit mới có thay đổi ở:

- `backend/prisma/migrations`
- `backend/prisma/schema.prisma`

thì dùng luồng này trên VPS:

```bash
cd /opt/fnb-stock-system
git pull --ff-only origin main
./ops.sh migrate
./ops.sh rebuild
./ops.sh status
```

Nếu `./ops.sh migrate` fail:

```bash
./ops.sh logs migrate 200
```

Không tiếp tục deploy khi migrate chưa pass.

Ghi nhớ:

- `migrate` hiện `Exited (0)` sau khi chạy xong là bình thường
- không chạy `db:seed` trên production

## 8. Nếu Chỉ Đổi Env Hoặc Config

Nếu bạn sửa một trong các file:

- `.env.production.compose`
- `backend/.env.production`
- `frontend/.env.production`

thì chạy:

```bash
cd /opt/fnb-stock-system
./ops.sh rebuild
./ops.sh status
```

Không nên chỉ `restart` sau khi đổi env, vì có trường hợp app vẫn giữ image hoặc config cũ.

## 9. Tình Huống Thực Tế: Chức Năng A Bị Lỗi, Fix Xong Đưa Lên Lại

Ví dụ người dùng báo lỗi ở chức năng A.

### 9.1. Ở local

```bash
git checkout main
git pull --ff-only origin main
```

Sửa code và push:

```bash
git add .
git commit -m "Fix loi chuc nang A"
git push origin main
```

### 9.2. Trên VPS

```bash
ssh root@103.165.144.144
cd /opt/fnb-stock-system
git pull --ff-only origin main
./ops.sh rebuild
./ops.sh status
```

### 9.3. Kiểm tra lại chức năng A

```bash
./ops.sh logs backend 100
./ops.sh logs frontend 100
./ops.sh health
```

Sau đó test tay chức năng A trên `https://fnbstore.store`.

Nếu fix liên quan đến DB:

```bash
git pull --ff-only origin main
./ops.sh migrate
./ops.sh rebuild
./ops.sh status
```

## 10. Cách Dừng App Để Bảo Trì Rồi Chạy Lại

Dừng tạm để bảo trì:

```bash
cd /opt/fnb-stock-system
./ops.sh stop
```

Bật lại:

```bash
./ops.sh up
./ops.sh status
```

Tắt hẳn stack:

```bash
./ops.sh down
```

Chạy lại từ đầu:

```bash
./ops.sh up
./ops.sh status
```

Nếu vừa pull code mới hoặc đổi env trong lúc bảo trì:

```bash
./ops.sh rebuild
./ops.sh status
```

## 11. Rollback Nhanh Về Commit Hoặc Tag Cũ

Chỉ rollback app khi bản mới lỗi. Nếu migration làm hỏng dữ liệu thì cần đánh giá restore DB riêng.

Xem lịch sử gần nhất:

```bash
cd /opt/fnb-stock-system
git log --oneline --decorate -n 10
git tag --sort=-creatordate | head
```

Rollback về tag hoặc commit cũ:

```bash
git checkout <tag-hoac-commit>
./ops.sh rebuild
./ops.sh status
```

Ví dụ:

```bash
git checkout v2026.04.22.1
./ops.sh rebuild
./ops.sh status
```

Hoặc:

```bash
git checkout a1b2c3d
./ops.sh rebuild
./ops.sh status
```

Sau khi rollback xong, test ngay:

```bash
./ops.sh health
./ops.sh logs backend 100
```

Khi muốn quay lại branch chính:

```bash
git checkout main
git pull --ff-only origin main
./ops.sh rebuild
```

## 12. Khi Có Sự Cố, Chạy Gì Trước

### 12.1. Website không vào được

```bash
cd /opt/fnb-stock-system
./ops.sh status
./ops.sh logs caddy 200
./ops.sh logs frontend 200
./ops.sh logs backend 200
```

### 12.2. Frontend mở được nhưng chức năng API lỗi

```bash
./ops.sh health
./ops.sh logs backend 200
```

### 12.3. `migrate` lỗi khi deploy

```bash
./ops.sh logs migrate 200
./ops.sh migrate
```

Nếu vẫn lỗi, kiểm tra `DATABASE_URL` trong `backend/.env.production`.

### 12.4. Bạn đã push fix nhưng production chưa ăn code mới

```bash
cd /opt/fnb-stock-system
git pull --ff-only origin main
./ops.sh rebuild
./ops.sh status
```

Không chỉ `restart` trong tình huống này.

### 12.5. Muốn biết app hiện có đang ổn không

```bash
./ops.sh status
```

## 13. Những Việc Không Nên Làm Trên Production

Không làm các việc sau:

- Không dùng `docker-compose.yml` local/demo để chạy production
- Không chạy lại `bootstrap:admin` nếu admin đầu tiên đã được tạo
- Không chạy `npm run db:seed` trên production
- Không sửa code trực tiếp trên VPS trừ tình huống khẩn cấp thật sự
- Không `git pull` khi worktree trên VPS đang bẩn mà chưa hiểu lý do
- Không dùng `restart` thay cho `rebuild` sau khi pull code mới hoặc đổi env

## 14. Cheat Sheet Copy-Paste

### 14.1. Kiểm tra nhanh

```bash
cd /opt/fnb-stock-system
./ops.sh status
```

### 14.2. Bật lại app

```bash
cd /opt/fnb-stock-system
./ops.sh up
./ops.sh status
```

### 14.3. Deploy code mới từ `main`

```bash
cd /opt/fnb-stock-system
git pull --ff-only origin main
./ops.sh rebuild
./ops.sh status
```

### 14.4. Deploy code mới có migration

```bash
cd /opt/fnb-stock-system
git pull --ff-only origin main
./ops.sh migrate
./ops.sh rebuild
./ops.sh status
```

### 14.5. Xem log backend

```bash
cd /opt/fnb-stock-system
./ops.sh logs backend 200
```

### 14.6. Dừng app

```bash
cd /opt/fnb-stock-system
./ops.sh stop
```

### 14.7. Tắt hẳn stack

```bash
cd /opt/fnb-stock-system
./ops.sh down
```

### 14.8. Rollback nhanh

```bash
cd /opt/fnb-stock-system
git log --oneline --decorate -n 10
git checkout <tag-hoac-commit>
./ops.sh rebuild
./ops.sh status
```
