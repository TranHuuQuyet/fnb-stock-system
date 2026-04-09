# API Overview

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
| POST | `/api/v1/admin/batches/:id/generate-qr` | ADMIN | Generate or regenerate QR |
| GET | `/api/v1/admin/batches/:id/qr` | ADMIN | Get QR payload |
| GET | `/api/v1/admin/batches/:id/label` | ADMIN | Get label preview data |
| POST | `/api/v1/admin/batches/:id/adjustments` | ADMIN | Create stock adjustment |
| GET | `/api/v1/admin/batches/:id/adjustments` | ADMIN | List stock adjustments |
| POST | `/api/v1/scan` | ADMIN, MANAGER, STAFF | Online scan |
| POST | `/api/v1/scan/manual` | ADMIN, MANAGER, STAFF | Manual fallback scan |
| POST | `/api/v1/scan/sync` | ADMIN, MANAGER, STAFF | Sync offline events |
| GET | `/api/v1/scan/logs` | ADMIN, MANAGER, STAFF | List scan logs by role scope |
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
