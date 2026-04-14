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
| GET | `/api/v1/scan/logs` | ADMIN, MANAGER, STAFF | List scan logs by role scope |
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
| GET | `/api/v1/admin/config` | ADMIN | Get app config |
| PATCH | `/api/v1/admin/config` | ADMIN | Update app config |
| POST | `/api/v1/pos/sales/import` | ADMIN | Import POS sales |
| GET | `/api/v1/pos/reconciliation` | ADMIN, MANAGER | Get reconciliation by store/date |
| POST | `/api/v1/anomalies/run` | ADMIN, MANAGER | Generate anomaly alerts |
| GET | `/api/v1/anomalies/alerts` | ADMIN, MANAGER | Get recent alerts |
| GET | `/api/v1/dashboard/summary` | ADMIN, MANAGER | Get dashboard summary |
| GET | `/api/v1/admin/audit-logs` | ADMIN | List audit logs |
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
- `MANAGER` hoặc `STAFF` muốn chuyển kho phải được cấp permission `scan_transfer`.
- Khi chuyển kho thành công, chi nhánh nguồn giảm tồn và chi nhánh đích tăng tồn theo cùng nguyên liệu.
