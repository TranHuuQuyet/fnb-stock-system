# API Overview

## Endpoint List

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Login by username/password |
| POST | `/api/v1/auth/logout` | ADMIN, MANAGER, STAFF | Logout current session |
| GET | `/api/v1/auth/me` | ADMIN, MANAGER, STAFF | Get current profile |
| POST | `/api/v1/auth/change-password` | ADMIN, MANAGER, STAFF | Change password / first login flow |
| POST | `/api/v1/admin/users` | ADMIN | Create user |
| GET | `/api/v1/admin/users` | ADMIN | List users |
| GET | `/api/v1/admin/users/:id` | ADMIN | Get user detail |
| PATCH | `/api/v1/admin/users/:id` | ADMIN | Update user |
| POST | `/api/v1/admin/users/:id/lock` | ADMIN | Lock user |
| POST | `/api/v1/admin/users/:id/unlock` | ADMIN | Unlock user |
| POST | `/api/v1/admin/users/:id/reset-password` | ADMIN | Reset user password |
| POST | `/api/v1/admin/stores` | ADMIN | Create store |
| GET | `/api/v1/admin/stores` | ADMIN | List stores |
| GET | `/api/v1/admin/stores/:id` | ADMIN | Get store detail |
| PATCH | `/api/v1/admin/stores/:id` | ADMIN | Update store |
| GET | `/api/v1/stores/accessible` | ADMIN, MANAGER, STAFF | List stores available for scoped selectors |
| POST | `/api/v1/admin/ingredients/units` | ADMIN | Create ingredient unit |
| GET | `/api/v1/admin/ingredients/units` | ADMIN | List ingredient units |
| PATCH | `/api/v1/admin/ingredients/units/:id` | ADMIN | Update ingredient unit |
| DELETE | `/api/v1/admin/ingredients/units/:id` | ADMIN | Delete ingredient unit |
| POST | `/api/v1/admin/ingredients` | ADMIN | Create ingredient |
| GET | `/api/v1/admin/ingredients` | ADMIN | List ingredients |
| GET | `/api/v1/admin/ingredients/groups` | ADMIN | List ingredient groups for admin forms and stock board layout |
| GET | `/api/v1/admin/ingredients/:id` | ADMIN | Get ingredient detail |
| PATCH | `/api/v1/admin/ingredients/:id` | ADMIN | Update ingredient |
| DELETE | `/api/v1/admin/ingredients/:id` | ADMIN | Disable ingredient |
| GET | `/api/v1/batches` | ADMIN, MANAGER, STAFF | List accessible batches |
| POST | `/api/v1/admin/batches` | ADMIN | Create batch |
| GET | `/api/v1/admin/batches` | ADMIN | List batches |
| GET | `/api/v1/admin/batches/:id` | ADMIN | Get batch detail |
| PATCH | `/api/v1/admin/batches/:id` | ADMIN | Update batch |
| POST | `/api/v1/admin/batches/:id/soft-lock` | ADMIN | Soft lock batch |
| POST | `/api/v1/admin/batches/:id/unlock` | ADMIN | Unlock batch |
| POST | `/api/v1/admin/batches/:id/generate-qr` | ADMIN | Generate or regenerate base batch QR |
| GET | `/api/v1/admin/batches/:id/qr` | ADMIN | Get base QR payload for the batch |
| GET | `/api/v1/admin/batches/:id/label` | ADMIN | Get print metadata, label counters, and next Number |
| POST | `/api/v1/admin/batches/:id/labels/issue` | ADMIN | Issue a sequential label range with unique QR per label |
| POST | `/api/v1/admin/batches/:id/adjustments` | ADMIN | Create stock adjustment |
| GET | `/api/v1/admin/batches/:id/adjustments` | ADMIN | List stock adjustments |
| POST | `/api/v1/scan` | ADMIN, MANAGER, STAFF | Online scan |
| POST | `/api/v1/scan/manual` | ADMIN, MANAGER, STAFF | Manual fallback scan |
| POST | `/api/v1/scan/sync` | ADMIN, MANAGER, STAFF | Sync offline events |
| GET | `/api/v1/scan/network-status` | ADMIN, MANAGER, STAFF | Detect current business network status and normalized IP |
| GET | `/api/v1/scan/logs` | ADMIN, MANAGER, STAFF | List scan logs by role scope |
| GET | `/api/v1/transfers/stores` | ADMIN, MANAGER, STAFF | List active stores for transfer source/destination selectors |
| GET | `/api/v1/transfers` | ADMIN, MANAGER, STAFF | List stock transfer tickets by role scope and direction |
| PATCH | `/api/v1/transfers/:id/confirm` | ADMIN, MANAGER | Confirm received quantity for an incoming transfer ticket |
| GET | `/api/v1/ingredient-stock-board` | ADMIN, MANAGER, STAFF | Get ingredient stock board by store, month, year, operation type |
| PUT | `/api/v1/ingredient-stock-board/layout` | ADMIN, MANAGER | Save stock board layout by store and operation type |
| POST | `/api/v1/admin/pos-products` | ADMIN | Create POS product |
| GET | `/api/v1/admin/pos-products` | ADMIN | List POS products |
| PATCH | `/api/v1/admin/pos-products/:id` | ADMIN | Update POS product |
| POST | `/api/v1/admin/recipes` | ADMIN | Create recipe item |
| GET | `/api/v1/admin/recipes` | ADMIN | List recipes |
| GET | `/api/v1/admin/recipes/:productId` | ADMIN | Get product recipes |
| PUT | `/api/v1/admin/recipes/:productId` | ADMIN | Replace product recipe mapping |
| POST | `/api/v1/admin/network-whitelists` | ADMIN | Create whitelist |
| GET | `/api/v1/admin/network-whitelists` | ADMIN | List whitelists |
| PATCH | `/api/v1/admin/network-whitelists/:id` | ADMIN | Update whitelist |
| DELETE | `/api/v1/admin/network-whitelists/:id` | ADMIN | Delete whitelist |
| GET | `/api/v1/admin/network-bypasses` | ADMIN | List emergency bypass status by store |
| PATCH | `/api/v1/admin/network-bypasses/:storeId` | ADMIN | Enable or disable emergency bypass for a store |
| GET | `/api/v1/admin/config` | ADMIN | Get app config |
| PATCH | `/api/v1/admin/config` | ADMIN | Update app config |
| GET | `/api/v1/admin/reports` | ADMIN | Get admin overview report for inventory, wastage, batch history, usage, and payroll |
| POST | `/api/v1/pos/sales/import` | ADMIN | Import POS sales |
| GET | `/api/v1/pos/reconciliation` | ADMIN, MANAGER | Get reconciliation by store/date |
| POST | `/api/v1/anomalies/run` | ADMIN, MANAGER | Generate anomaly alerts |
| GET | `/api/v1/anomalies/alerts` | ADMIN, MANAGER | Get recent alerts |
| GET | `/api/v1/dashboard/summary` | ADMIN, MANAGER | Get dashboard summary |
| GET | `/api/v1/admin/audit-logs` | ADMIN | List audit logs |
| GET | `/api/v1/work-schedules` | ADMIN, MANAGER, STAFF | Get monthly work schedule by year, month, and store scope |
| PUT | `/api/v1/work-schedules` | ADMIN | Save monthly work schedule, shifts, employee rates, and month status |
| GET | `/api/v1/health` | Public | Liveness check |
| GET | `/api/v1/health/ready` | Public | Readiness check with DB check |

## Batch Label API Notes

### `GET /api/v1/admin/batches/:id/label`

Trả metadata để frontend hiển thị màn in tem, gồm các trường quan trọng:

- `batchId`
- `batchCode`
- `ingredientName`
- `storeName`
- `unit`
- `initialQty`
- `printedLabelCount`
- `maxPrintableLabels`
- `remainingLabelCount`
- `nextLabelNumber`
- `labelCreatedAt`
- `qrCodeValue`

### `POST /api/v1/admin/batches/:id/labels/issue`

Request body:

```json
{
  "quantity": 10
}
```

Response data chính:

- `issuedQuantity`: số tem vừa phát hành
- `issuedFromNumber`: Number bắt đầu của lượt in
- `issuedToNumber`: Number kết thúc của lượt in
- `printedLabelCount`: tổng số tem đã phát hành sau khi cập nhật
- `labels`: danh sách tem vừa cấp

Ví dụ mỗi phần tử trong `labels`:

```json
{
  "sequenceNumber": 11,
  "qrCodeValue": "FNBBATCH:MILK-001|BATCH:clx123|SEQ:11"
}
```

## QR Compatibility

Frontend scanner hỗ trợ cả hai định dạng sau:

- Legacy: `FNBBATCH:<batch_code>`
- Current issued label: `FNBBATCH:<batch_code>|BATCH:<batch_id>|SEQ:<sequenceNumber>`

Trong cả hai trường hợp, frontend đều tách ra `batchCode` trước khi gửi request scan.

## Ingredient Stock Board API Notes

### `GET /api/v1/ingredient-stock-board`

Query params chính:

- `storeId?`: chỉ `ADMIN` được đổi chi nhánh
- `year`
- `month`
- `operationType`: `STORE_USAGE | TRANSFER`

Response data chính:

- `store`
- `daysInMonth`
- `shifts`
- `summary`
- `alerts`
- `layout.groups`
- `options.groups`
- `options.ingredients`
- `canEdit`

Quy tắc nghiệp vụ:

- `ADMIN` và `MANAGER` có thể chỉnh bố cục, `STAFF` chỉ xem.
- `Số lượng tồn` là tổng tồn của tất cả lô còn lại của cùng nguyên liệu trong chi nhánh đã chọn.
- Các ô ngày/ca chỉ cộng `ScanLog` có trạng thái `SUCCESS` hoặc `WARNING`.
- Với `operationType = TRANSFER`, bảng thể hiện lượng xuất khỏi chi nhánh đang chọn.

### `PUT /api/v1/ingredient-stock-board/layout`

Request body mẫu:

```json
{
  "storeId": "store-id",
  "operationType": "STORE_USAGE",
  "groups": [
    {
      "groupId": "group-id",
      "sortOrder": 0,
      "items": [
        {
          "ingredientId": "ingredient-id",
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

Validation chính:

- Không được trùng `groupId` trong cùng một bố cục.
- Một nguyên liệu chỉ được xuất hiện một lần.
- Nguyên liệu phải thuộc đúng nhóm đã chọn.
- Bố cục được lưu riêng theo `storeId + operationType`.

## Scan And Transfer Notes

- Scan API hỗ trợ `operationType = STORE_USAGE | TRANSFER`.
- `ADMIN` luôn có thể chuyển kho.
- `MANAGER` có thể chuyển kho theo role; `STAFF` muốn chuyển kho phải được cấp permission `scan_transfer`.
- Khi tạo chuyển kho, hệ thống trừ tồn ở chi nhánh nguồn ngay và tạo `StockTransfer` ở trạng thái `IN_TRANSIT`.
- Chi nhánh đích chỉ tăng tồn sau khi `ADMIN` hoặc `MANAGER` của chi nhánh nhận xác nhận phiếu qua `PATCH /transfers/:id/confirm`.
- Nếu số lượng nhận nhỏ hơn số lượng gửi, request xác nhận bắt buộc có `note` để lưu chênh lệch.

## Transfer API Notes

### `GET /api/v1/transfers`

Query params chính:

- `storeId?`: chỉ `ADMIN` được đổi chi nhánh
- `batchCode?`
- `status?`: `IN_TRANSIT | RECEIVED`
- `direction?`: `ALL | INCOMING | OUTGOING`
- `startDate?`
- `endDate?`

Response data chính:

- `sourceStore`
- `destinationStore`
- `ingredient`
- `quantityRequested`
- `quantityReceived`
- `status`
- `confirmationNote`
- `discrepancyQty`
- `canConfirm`

Quy tắc nghiệp vụ:

- `MANAGER` chỉ nhìn thấy phiếu của chi nhánh mình theo vai trò gửi/nhận.
- `STAFF` không có quyền xác nhận phiếu nhận hàng.
- `canConfirm = true` khi phiếu còn `IN_TRANSIT` và user hiện tại là `ADMIN` hoặc `MANAGER` của chi nhánh nhận.

### `PATCH /api/v1/transfers/:id/confirm`

Request body mẫu:

```json
{
  "receivedQty": 9,
  "note": "Thiếu 1 chai do hỏng khi vận chuyển"
}
```

Validation chính:

- `receivedQty` không được âm.
- `receivedQty` không được lớn hơn `quantityRequested`.
- Nếu `receivedQty < quantityRequested`, `note` là bắt buộc.
- `MANAGER` chỉ được xác nhận phiếu mà `destinationStoreId` thuộc chi nhánh của tài khoản.

## Network Control Notes

### `GET /api/v1/scan/network-status`

Query params chính:

- `storeId?`: chỉ `ADMIN` được đổi chi nhánh
- `ssid?`: optional, chủ yếu để chẩn đoán tương thích

Response data chính:

- `storeId`
- `ipAddress`
- `normalizedIpAddress`
- `hasActiveWhitelist`
- `isAllowedByWhitelist`
- `matchedWhitelistTypes`
- `bypassEnabled`
- `bypassActive`
- `bypassExpiresAt`
- `bypassReason`
- `canAccessBusinessOperations`

Quy tắc nghiệp vụ:

- Luồng web hiện tại ưu tiên `IP whitelist` và `Emergency bypass`; `SSID` không phải cơ chế chính trong browser flow.
- Nếu `bypassActive = true`, chi nhánh vẫn được phép thao tác nghiệp vụ dù IP hiện tại chưa được whitelist.
- Endpoint này phù hợp cho màn admin lấy chính xác IP mà backend đang nhìn thấy trước khi thêm whitelist.

### `PATCH /api/v1/admin/network-bypasses/:storeId`

Request body mẫu:

```json
{
  "enabled": true,
  "expiresAt": "2026-04-30T17:00:00.000Z",
  "reason": "Router thay IP, mở tạm trong giờ cao điểm"
}
```

Validation chính:

- Khi `enabled = true`, `expiresAt` là bắt buộc và phải nằm trong tương lai.
- Emergency bypass chỉ nên bật tạm thời khi mạng chi nhánh thay đổi đột xuất.
- Mọi thay đổi whitelist hoặc bypass đều được ghi `AuditLog`.

## Work Schedule API Notes

### `GET /api/v1/work-schedules`

Query params chính:

- `year`
- `month`
- `storeId?`: chỉ `ADMIN` được đổi chi nhánh

Response data chính:

- `store`
- `year`
- `month`
- `daysInMonth`
- `weekendDays`
- `canEdit`
- `schedule.id`
- `schedule.title`
- `schedule.notes`
- `schedule.status`
- `schedule.shifts`
- `schedule.employees`
- `schedule.employees[].allowanceAmount`
- `schedule.employees[].lateMinutes`
- `schedule.employees[].earlyLeaveMinutes`
- `schedule.employees[].totals`

Quy tắc nghiệp vụ:

- `ADMIN` được đổi chi nhánh; `MANAGER` và `STAFF` chỉ xem bảng của chi nhánh tài khoản.
- Nếu tháng chưa có dữ liệu lưu sẵn, backend trả khung mặc định `Ca 1 / Ca 2 / Ca 3`.
- Backend tự bổ sung danh sách `MANAGER/STAFF` active của chi nhánh vào bảng để admin tiện sắp ca.

### `PUT /api/v1/work-schedules`

Request body chính gồm:

- `year`, `month`, `storeId?`
- `title`, `notes`, `status`
- `shifts[]`
- `employees[]`
- `employees[].trialHourlyRate`
- `employees[].officialHourlyRate`
- `employees[].allowanceAmount?`
- `employees[].lateMinutes?`
- `employees[].earlyLeaveMinutes?`

Validation chính:

- Chỉ `ADMIN` được lưu hoặc cập nhật bảng chấm công.
- `shifts` phải có ít nhất một phần tử và không được trùng `key`.
- `entries.day` phải nằm trong số ngày hợp lệ của tháng đang lưu.
- `LOCKED` là trạng thái khóa chỉnh sửa trên UI; `ADMIN` có thể chuyển lại sang `DRAFT` hoặc `PUBLISHED` để mở khóa tạm thời.

## Admin Report Notes

### `GET /api/v1/admin/reports`

Query params chính:

- `storeId`
- `startDate?`
- `endDate?`
- `year?`
- `month?`

Response data chính:

- `summary`
- `inventorySnapshot`
- `wastage`
- `batchHistory`
- `topIngredients`
- `workScheduleSummary`

Quy tắc nghiệp vụ:

- Endpoint hiện trả `tồn kho hiện tại` theo snapshot lúc mở báo cáo, không phải snapshot lịch sử đã lưu sẵn theo từng ngày.
- `wastage` được tổng hợp từ các phiếu `StockAdjustment` loại `DECREASE`.
- `workScheduleSummary` dùng tháng/năm được chọn để tổng hợp lương theo giờ, phụ cấp, đi trễ và về sớm.
