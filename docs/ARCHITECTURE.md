# Architecture

## Backend Modules

- `auth`: login, logout, me, change password, JWT strategy
- `users`: admin user management, lock/unlock, reset password
- `stores`: admin store management
- `ingredients`: ingredient master data
- `batches`: batch CRUD, accessible batch listing, soft lock/unlock
- `batch-labels`: generate base QR, return print metadata, issue sequential labels with unique QR per tem
- `stock-adjustments`: manual inventory adjustment with audit
- `scan`: online scan, manual fallback, offline sync, scan logs
- `devices`: device upsert and last-seen tracking
- `pos`: POS product CRUD, recipe CRUD, sales import, reconciliation
- `anomalies`: threshold-based anomaly generation from reconciliation
- `dashboard`: summary cards, reconciliation, recent fraud/scans/alerts
- `audit`: structured admin audit logs
- `config`: app config and store network whitelist management
- `health`: liveness and readiness checks

## Core Data Notes

- `IngredientBatch` là thực thể trung tâm cho nghiệp vụ lô hàng.
- Các field chính liên quan đến in tem:
  - `batchCode`: mã lô dùng để tra cứu và scan
  - `initialQty`: số lượng ban đầu của lô
  - `remainingQty`: số lượng còn lại sau khi sử dụng hoặc điều chỉnh
  - `qrCodeValue`: QR nền của lô, có dạng `FNBBATCH:<batch_code>`
  - `printedLabelCount`: số tem đã được phát hành cho lô
  - `labelCreatedAt`: thời điểm phát hành tem gần nhất
- `printedLabelCount` được dùng để đảm bảo `Number` trên tem luôn tăng liên tục theo từng lô.

## Auth And User Management Flow

1. User login bằng `username/password`.
2. Backend kiểm tra trạng thái `ACTIVE | MUST_CHANGE_PASSWORD | LOCKED | INACTIVE`.
3. JWT payload được refresh lại trạng thái user ở `JwtStrategy`.
4. Nếu `MUST_CHANGE_PASSWORD`, frontend bắt buộc redirect sang `/change-password`.
5. Admin tạo user với temporary password, reset password và lock/unlock đều ghi `AuditLog`.

## Scan Flow

1. Frontend quét QR tem hoặc dùng nhập tay với `batchCode`.
2. Scanner chấp nhận cả 2 định dạng:
   - tem cũ: `FNBBATCH:<batch_code>`
   - tem mới: `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`
3. Frontend luôn trích `batchCode` từ QR trước khi gửi request scan.
4. Frontend gửi `batchCode`, `quantityUsed`, `scannedAt`, `deviceId`, `clientEventId`, `storeId?`, `entryMethod`.
5. Backend upsert device, kiểm tra whitelist IP/SSID.
6. Backend tìm batch theo `storeId + batchCode`.
7. Backend validate expired, soft lock, remaining quantity và FIFO.
8. Nếu hợp lệ: trừ tồn, update `DEPLETED` khi về 0, ghi `ScanLog`.
9. Nếu bị chặn bởi network policy: ghi `FraudAttemptLog` và `ScanLog` lỗi.
10. Nếu duplicate `clientEventId`: trả `duplicated=true`, không trừ kho lần nữa.

## Offline Sync Flow

1. Khi browser offline, scan event được lưu vào IndexedDB.
2. Event giữ nguyên `clientEventId` để đồng bộ idempotent.
3. Hook `useOfflineSync` tự gửi `/scan/sync` khi có mạng.
4. Backend xử lý từng event độc lập, không fail cả batch.
5. Event sync xong được xóa khỏi queue, event lỗi giữ lại với trạng thái `failed`.

## QR And Label Printing Flow

1. Khi tạo batch, backend sinh `qrCodeValue = FNBBATCH:<batch_code>`.
2. Admin có thể làm mới QR nền của lô qua `POST /api/v1/admin/batches/:id/generate-qr`.
3. Frontend mở màn in tem và gọi `GET /api/v1/admin/batches/:id/label` để lấy:
   - thông tin lô
   - `printedLabelCount`
   - `maxPrintableLabels`
   - `remainingLabelCount`
   - `nextLabelNumber`
4. Khi admin nhập số tem cần in, frontend gọi `POST /api/v1/admin/batches/:id/labels/issue`.
5. Backend phát hành dải số liên tục cho đúng lô bằng transaction và optimistic guard trên `printedLabelCount`.
6. Mỗi tem được trả về một QR riêng theo công thức:
   - `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`
7. Frontend render toàn bộ tem của lần phát hành, sau đó mới gọi `window.print()`.
8. Mặc định bố cục in là `2 cột x 5 hàng = 10 tem/trang`, nhưng admin có thể chỉnh số cột và số hàng trên màn in.
9. Route frontend cũ `/admin/batches/[id]/label` hiện redirect sang màn in mới để tránh dùng lại luồng preview cũ.

## Reconciliation Flow

1. POS sales được import vào `PosSale`.
2. Recipe map `PosProduct -> Ingredient`.
3. Reconciliation tính:
   - `expectedQty = sum(qtySold * qtyPerUnit)`
   - `actualQty = sum(scan logs SUCCESS/WARNING)`
4. Ratio `actual / expected`.
5. Dashboard highlight ratio dưới threshold.

## Stock Adjustment Flow

1. Chỉ `ADMIN` được tạo adjustment.
2. Validate quantity > 0 và không giảm quá tồn.
3. Transaction cập nhật `remainingQty`, `status`, tạo `StockAdjustment`.
4. Ghi `AuditLog` với `oldData/newData`.
