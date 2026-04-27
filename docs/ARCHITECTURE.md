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
- `scan`: online scan, quick store-usage consume, transfer, scan logs
- `devices`: device upsert and last-seen tracking
- `pos`: POS product CRUD, recipe CRUD, sales import, reconciliation APIs
- `anomalies`: threshold-based anomaly generation from reconciliation APIs
- `dashboard`: summary API cho reconciliation, fraud/scans/alerts; route web `/dashboard` hiện không còn là luồng chính
- `audit`: structured admin audit logs
- `config`: app config, store network whitelist, emergency bypass, business network status
- `work-schedules`: bảng chấm công theo tháng, ca làm việc, đơn giá thử việc/chính thức, phụ cấp, đi trễ/về sớm, bảng lương
- `reports`: báo cáo quản trị cho tồn kho hiện tại, hao hụt, lịch sử batch, top nguyên liệu dùng nhiều và lương tháng
- `health`: liveness and readiness checks

## Current Web Surface

- Route gốc `/` tự redirect theo role:
  - `ADMIN -> /admin/reports`
  - `MANAGER/STAFF -> /scan`
- Navigation web hiện tại tập trung vào các màn:
  - `Scan`, `Scan logs`, `Ingredient stock`, `Work schedules`, `Profile`
  - `Admin users`, `Admin stores`, `Admin ingredients`, `Admin batches`, `Admin batch adjustments`, `Admin config`, `Admin whitelists`, `Admin reports`, `Admin audit logs`
- Hai route `/dashboard` và `/admin/recipes` vẫn còn file/page để redirect tương thích, nhưng không còn được dùng như màn vận hành chính.
- Backend vẫn giữ các API `dashboard`, `recipes`, `pos`, `anomalies` cho nhu cầu tích hợp hoặc mở lại UI về sau.

## Core Data Notes

- `IngredientBatch` là thực thể trung tâm cho nghiệp vụ lô hàng.
- `Ingredient` hiện gắn với `IngredientGroup` để dùng chung cho admin form và `Kho nguyên liệu`.
- `IngredientStockLayout`, `IngredientStockLayoutGroup`, `IngredientStockLayoutItem` lưu bố cục hiển thị theo `storeId + operationType`.
- `StoreNetworkWhitelist` và các field `networkBypass*` trên `Store` dùng để kiểm soát thao tác nghiệp vụ theo mạng của chi nhánh.
- `StockTransfer` lưu phiếu chuyển kho giữa hai chi nhánh, gồm số lượng gửi, số lượng nhận, trạng thái `IN_TRANSIT | RECEIVED`, ghi chú chênh lệch và người xác nhận.
- `WorkSchedule`, `WorkScheduleShift`, `WorkScheduleEmployee`, `WorkScheduleEntry` lưu bảng chấm công theo `storeId + year + month`; trong đó `WorkScheduleEmployee` còn giữ `allowanceAmount`, `lateMinutes`, `earlyLeaveMinutes` để tính bảng lương thực nhận.
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
2. Backend kiểm tra trạng thái `ACTIVE | MUST_CHANGE_PASSWORD | LOCKED | INACTIVE`, lockout tạm thời và số lần login sai.
3. Login response chỉ trả `user + mustChangePassword`; `accessToken` được đặt trong `HttpOnly cookie`.
4. Frontend chỉ giữ metadata session cho UI; route guard sẽ gọi `auth/me` để resolve phiên hiện tại.
5. Nếu `MUST_CHANGE_PASSWORD`, frontend bắt buộc redirect sang `/change-password`.
6. `sessionVersion` được nhúng trong JWT để logout, reset password, đổi password, lock/unlock hoặc soft delete có thể revoke session cũ ngay.
7. Admin tạo user với temporary password, reset password và lock/unlock đều ghi `AuditLog`.

## User And Store Soft Delete Flow

1. Admin gọi `DELETE /admin/users/:id` hoặc `DELETE /admin/stores/:id` kèm `adminPassword`.
2. Backend không hard-delete dữ liệu nghiệp vụ:
   - user bị chuyển sang `INACTIVE`
   - store bị chuyển `isActive = false`
3. Lịch sử batch, scan, transfer, audit và work schedule vẫn được giữ nguyên để tra cứu.
4. Soft delete user còn reset lockout counters và tăng `sessionVersion` để chặn phiên cũ tiếp tục dùng.

## Business Network Control Flow

1. Admin cấu hình `IP whitelist` cho từng chi nhánh hoặc bật `Emergency bypass` có thời hạn.
2. Frontend admin có thể gọi `GET /scan/network-status` để lấy IP mà backend thực sự nhìn thấy trước khi thêm whitelist.
3. Với user không phải `ADMIN`, các route có `@RequireBusinessNetwork()` sẽ check trạng thái mạng theo chi nhánh của user.
4. Luồng web hiện tại ưu tiên `IP whitelist`; `SSID` không phải cơ chế chính trong browser flow.
5. Nếu `bypassActive` hoặc IP hiện tại khớp whitelist, user được phép tiếp tục thao tác nghiệp vụ.
6. Nếu bị chặn, backend trả `ERROR_NETWORK_RESTRICTED`; riêng luồng scan còn ghi thêm `FraudAttemptLog` và `ScanLog` lỗi.

## Scan Flow

1. Màn `Scan` cho `STAFF` và `MANAGER` ở chế độ `Sử dụng tại quán` dùng camera-only, không còn nhập tay và không còn nút gửi kết quả quét.
2. Scanner chấp nhận cả 2 định dạng:
   - tem cũ: `FNBBATCH:<batch_code>`
   - tem mới: `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`
3. Ở quick mode, frontend chỉ tự gửi request khi QR là tem mới có `BATCH + SEQ`.
4. Quick mode gửi `batchCode`, `quantityUsed = 1`, `scannedLabelValue`, `scannedLabelBatchId`, `scannedLabelSequenceNumber`, `scannedAt`, `deviceId`, `clientEventId`, `storeId?`, `entryMethod = CAMERA`.
5. Backend upsert device, đánh giá trạng thái business network theo `IP whitelist` và `Emergency bypass`.
6. Backend tìm batch theo `storeId + batchCode`, validate tem thuộc đúng batch và `sequenceNumber <= printedLabelCount`.
7. Backend validate expired, soft lock, remaining quantity và FIFO.
8. Nếu tem đã từng được dùng ở `STORE_USAGE`, backend reject theo `consumedLabelKey` để không trừ kho lặp.
9. Nếu hợp lệ: trừ tồn, update `DEPLETED` khi về 0, ghi `ScanLog`.
10. Với `operationType = TRANSFER`, backend cho `ADMIN` và `MANAGER` tạo phiếu chuyển theo role; `STAFF` phải có permission `scan_transfer`.
11. Khi tạo phiếu chuyển, backend trừ tồn ở chi nhánh nguồn, ghi `ScanLog` xuất kho và tạo `StockTransfer` trạng thái `IN_TRANSIT`.
12. Chi nhánh đích chỉ được cộng tồn sau khi `ADMIN` hoặc `MANAGER` của chi nhánh nhận xác nhận phiếu.
13. Nếu bị chặn bởi network policy: ghi `FraudAttemptLog` và `ScanLog` lỗi.
14. Nếu duplicate `clientEventId`: trả `duplicated=true`, không trừ kho lần nữa.

## Transfer Confirmation Flow

1. Chi nhánh nguồn tạo phiếu chuyển từ màn `Scan` với `operationType = TRANSFER`.
2. Hàng rời kho nguồn ngay sau khi phiếu được tạo, nhưng chưa cộng vào kho đích.
3. Màn `Scan Logs` của chi nhánh nhận gọi `GET /transfers` để xem các phiếu `IN_TRANSIT`.
4. `ADMIN` hoặc `MANAGER` của chi nhánh nhận xác nhận số lượng thực nhận qua `PATCH /transfers/:id/confirm`.
5. Nếu nhận đủ, hệ thống cộng đúng số lượng vào batch đích và đổi trạng thái phiếu sang `RECEIVED`.
6. Nếu nhận thiếu, hệ thống vẫn đổi phiếu sang `RECEIVED` nhưng bắt buộc lưu `confirmationNote` để giữ vết chênh lệch.

## Offline Sync Flow

1. Hạ tầng `/scan/sync` vẫn còn cho compatibility cũ.
2. Hook `useOfflineSync` vẫn theo dõi IndexedDB để đồng bộ backlog legacy nếu thiết bị cũ còn tạo event offline.
3. UI scan hiện tại cho `STAFF` và `MANAGER` không còn dùng offline queue ở quick mode; mất mạng sẽ bị chặn ngay trên màn scan.
4. Nếu cần đồng bộ offline cho luồng cũ, event vẫn giữ nguyên `clientEventId` để idempotent.

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

## Work Schedule Flow

1. Frontend gọi `GET /work-schedules` với `year`, `month`, `storeId?`.
2. `ADMIN` được đổi chi nhánh; `MANAGER` và `STAFF` bị khóa theo chi nhánh của tài khoản.
3. Nếu tháng chưa có dữ liệu, backend trả khung mặc định `Ca 1 / Ca 2 / Ca 3` và tự bổ sung các user `MANAGER/STAFF` active của chi nhánh vào bảng.
4. `ADMIN` có thể lưu toàn bộ bảng qua `PUT /work-schedules`, gồm ca làm, đơn giá thử việc/chính thức, phụ cấp, đi trễ/về sớm, entries, ghi chú, trạng thái tháng.
5. UI hỗ trợ `In bảng chấm công`, `In bảng lương`, `Xuất CSV`, `Xuất Excel`; `MANAGER` và `STAFF` chỉ xem bảng hiện có.
6. Khi trạng thái chuyển sang `LOCKED`, grid chấm công bị khóa; `ADMIN` vẫn có thể đổi trạng thái về `DRAFT` hoặc `PUBLISHED` để mở khóa tạm thời.

## Admin Report Flow

1. Frontend admin gọi `GET /admin/reports` với `storeId`, khoảng ngày của báo cáo vận hành và `year/month` cho bảng lương.
2. Backend trả một payload tổng hợp gồm:
   - tồn kho hiện tại theo nguyên liệu
   - hao hụt từ `StockAdjustment`
   - lịch sử batch trong kỳ
   - top nguyên liệu dùng nhiều từ `ScanLog`
   - tổng hợp bảng lương tháng từ `WorkSchedule`
3. Frontend render các bảng tổng hợp và cho phép `Xuất Excel` để admin gửi cho chủ hoặc kế toán.
4. Đây là màn landing mặc định của `ADMIN` trong web UI hiện tại, thay cho dashboard cũ.
