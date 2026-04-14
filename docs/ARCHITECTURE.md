# Architecture

## Backend Modules

- `auth`: login, logout, me, change password, JWT strategy
- `users`: admin user management, lock/unlock, reset password
- `stores`: admin store management
- `ingredients`: ingredient master data
- `ingredient-stock-board`: dựng bảng kho nguyên liệu theo tháng, nhóm, ngày/ca và lưu bố cục hiển thị
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
- `Ingredient` hiện gắn với `IngredientGroup` để dùng chung cho admin form và `Kho nguyên liệu`.
- `IngredientStockLayout`, `IngredientStockLayoutGroup`, `IngredientStockLayoutItem` lưu bố cục hiển thị theo `storeId + operationType`.
- Các field chính liên quan đến in tem:
  - `batchCode`: mã lô dùng để tra cứu và scan
  - `initialQty`: số lượng ban đầu của lô
  - `remainingQty`: số lượng còn lại sau khi sử dụng hoặc điều chỉnh
  - `qrCodeValue`: QR nền của lô, có dạng `FNBBATCH:<batch_code>`
  - `printedLabelCount`: số tem đã được phát hành cho lô
  - `labelCreatedAt`: thời điểm phát hành tem gần nhất
- `printedLabelCount` được dùng để đảm bảo `Number` trên tem luôn tăng liên tục theo từng lô.

## Ingredient Stock Board Flow

1. Frontend gọi `GET /ingredient-stock-board` với `storeId?`, `year`, `month`, `operationType`.
2. Backend resolve phạm vi chi nhánh theo role:
   - `ADMIN` được đổi chi nhánh
   - `MANAGER` và `STAFF` bị khóa theo chi nhánh của tài khoản
3. Backend lấy `WorkSchedule` theo `storeId + year + month` để map giờ quét vào ca; nếu chưa có lịch sẽ dùng mặc định `Ca 1 / Ca 2 / Ca 3`.
4. Backend đọc `ScanLog` hợp lệ (`SUCCESS`, `WARNING`) theo `operationType` và cộng vào đúng ô `ngày / ca`.
5. Backend cộng `remainingQty` của tất cả `IngredientBatch` còn tồn để ra `Số lượng tồn` của từng nguyên liệu.
6. Nếu chi nhánh chưa có bố cục lưu sẵn, backend tự dựng bố cục mặc định theo `IngredientGroup` và danh sách nguyên liệu active.
7. `ADMIN` và `MANAGER` có thể lưu lại bố cục qua `PUT /ingredient-stock-board/layout`; `STAFF` chỉ xem.
8. Frontend áp dụng thêm bộ lọc `Loại nguyên liệu / Nguyên liệu` và mobile compact view để quan sát nhanh hơn.

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
9. Với `operationType = TRANSFER`, backend kiểm tra thêm permission `scan_transfer` cho user không phải `ADMIN`, trừ tồn ở chi nhánh nguồn và tăng tồn ở chi nhánh đích.
10. Nếu bị chặn bởi network policy: ghi `FraudAttemptLog` và `ScanLog` lỗi.
11. Nếu duplicate `clientEventId`: trả `duplicated=true`, không trừ kho lần nữa.

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
