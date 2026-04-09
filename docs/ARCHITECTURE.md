# Architecture

## Backend Modules

- `auth`: login, logout, me, change password, JWT strategy
- `users`: admin user management, lock/unlock, reset password
- `stores`: admin store management
- `ingredients`: ingredient master data
- `batches`: batch CRUD, public batch listing, soft lock/unlock
- `batch-labels`: generate QR, get QR, get label data for browser print
- `stock-adjustments`: manual inventory adjustment with audit
- `scan`: online scan, manual fallback, offline sync, scan logs
- `devices`: device upsert and last-seen tracking
- `pos`: POS product CRUD, recipe CRUD, sales import, reconciliation
- `anomalies`: threshold-based anomaly generation from reconciliation
- `dashboard`: summary cards, reconciliation, recent fraud/scans/alerts
- `audit`: structured admin audit logs
- `config`: app config and store network whitelist management
- `health`: liveness and readiness checks

## Auth And User Management Flow

1. User login bằng `username/password`
2. Backend kiểm tra `ACTIVE | MUST_CHANGE_PASSWORD | LOCKED | INACTIVE`
3. JWT payload được refresh lại trạng thái user ở `JwtStrategy`
4. Nếu `MUST_CHANGE_PASSWORD`, frontend redirect bắt buộc sang `/change-password`
5. Admin tạo user với temporary password, reset password và lock/unlock đều ghi audit log

## Scan Flow

1. Frontend scan QR batch hoặc manual fallback nhập `batchCode`
2. Frontend gửi `batchCode`, `quantityUsed`, `scannedAt`, `deviceId`, `clientEventId`, `ssid?`
3. Backend upsert device, kiểm tra whitelist IP/SSID
4. Tìm batch theo `storeId + batchCode`
5. Validate expired, soft lock, remaining quantity, FIFO
6. Nếu hợp lệ: trừ tồn, update `DEPLETED` khi về 0, ghi `ScanLog`
7. Nếu bị chặn network: ghi `FraudAttemptLog` và `ScanLog` lỗi
8. Nếu duplicate `clientEventId`: trả `duplicated=true`, không trừ kho lại

## Offline Sync Flow

1. Khi browser offline, scan event được lưu vào IndexedDB
2. Event giữ nguyên `clientEventId`
3. Hook `useOfflineSync` tự gửi `/scan/sync` khi có mạng
4. Backend xử lý từng event độc lập, không fail cả batch
5. Event sync xong được xóa khỏi queue, event lỗi giữ lại với trạng thái `failed`

## Reconciliation Flow

1. POS sales import vào `PosSale`
2. Recipe map `PosProduct -> Ingredient`
3. Reconciliation tính:
   - `expectedQty = sum(qtySold * qtyPerUnit)`
   - `actualQty = sum(scan logs SUCCESS/WARNING)`
4. Ratio `actual / expected`
5. Dashboard highlight ratio dưới threshold

## Stock Adjustment Flow

1. Chỉ `ADMIN` được tạo adjustment
2. Validate quantity > 0 và không giảm quá tồn
3. Transaction cập nhật `remainingQty`, `status`, tạo `StockAdjustment`
4. Ghi `AuditLog` với `oldData/newData`

## QR Generation And Label Printing Flow

1. Khi tạo batch, backend sinh `qrCodeValue = FNBBATCH:<batch_code>`
2. Admin có thể regenerate QR qua `/admin/batches/:id/generate-qr`
3. `/admin/batches/:id/label` trả đủ data cho label preview
4. Frontend render QR bằng React và gọi `window.print()` để in từ browser
