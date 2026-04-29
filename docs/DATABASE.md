# Database Schema & Data Model

Updated: 2026-04-27

## Overview

The FNB Stock Control System uses PostgreSQL with Prisma ORM. The database stores:
- User authentication and authorization data
- Store/branch information and network configuration
- Ingredient master data and categorization
- Batch/lot tracking with QR codes
- Scan logs and transfer operations
- Work schedules and payroll
- POS integration and reconciliation
- Audit trails for all operations

## Core Tables

### Users & Authentication

#### `User`
```prisma
- id: String (UUID, primary)
- username: String (unique)
- email: String
- passwordHash: String
- role: UserRole (ADMIN, MANAGER, STAFF)
- storeId: String (foreign key, nullable)
- isLocked: Boolean
- mustChangePassword: Boolean
- sessionVersion: Int (for session invalidation)
- createdAt: DateTime
- updatedAt: DateTime
- lastLoginAt: DateTime (nullable)
```

**Notes:**
- `storeId` scopes MANAGER and STAFF to a specific store
- `sessionVersion` increments on logout, password change, lock/unlock
- `mustChangePassword` triggers forced password change flow

#### `AuditLog`
```prisma
- id: String (UUID, primary)
- userId: String (foreign key)
- action: String (CREATE, UPDATE, DELETE, etc)
- entity: String (User, Batch, Transfer, etc)
- entityId: String (referenced entity ID)
- changes: JSON (before/after values)
- metadata: JSON (IP, user agent, etc)
- createdAt: DateTime
```

**Purpose:** Complete audit trail for compliance and troubleshooting

### Store Management

#### `Store`
```prisma
- id: String (UUID, primary)
- name: String (store/branch name)
- address: String
- phone: String
- networkBypassEnabled: Boolean
- networkBypassExpiresAt: DateTime (nullable)
- networkBypassReason: String
- createdAt: DateTime
- updatedAt: DateTime
```

**Notes:**
- `networkBypassEnabled` allows emergency access override
- `networkBypassExpiresAt` auto-disables after timeout

#### `StoreNetworkWhitelist`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- ipAddress: String
- description: String
- isActive: Boolean
- createdAt: DateTime
- updatedAt: DateTime
```

**Purpose:** Store-specific IP whitelist for network-based access control

### Ingredient Master Data

#### `IngredientUnit`
```prisma
- id: String (UUID, primary)
- name: String (kg, liters, pieces, etc)
- abbreviation: String
- isActive: Boolean
- createdAt: DateTime
- updatedAt: DateTime
```

**Notes:**
- Reusable across ingredients
- Can be deactivated without deleting

#### `IngredientGroup`
```prisma
- id: String (UUID, primary)
- name: String (Vegetables, Meat, Dairy, etc)
- description: String
- sortOrder: Int
- isActive: Boolean
- createdAt: DateTime
- updatedAt: DateTime
```

**Purpose:** Categorize ingredients for stock board grouping

#### `Ingredient`
```prisma
- id: String (UUID, primary)
- name: String
- code: String (unique)
- description: String
- unitId: String (foreign key)
- groupId: String (foreign key)
- isActive: Boolean
- minimumStock: Int (nullable)
- createdAt: DateTime
- updatedAt: DateTime
```

**Notes:**
- Links to unit and group
- `minimumStock` for low-stock warnings
- `isActive` allows soft delete

### Batch & Inventory

#### `IngredientBatch`
```prisma
- id: String (UUID, primary)
- ingredientId: String (foreign key)
- storeId: String (foreign key)
- batchCode: String (unique per store)
- batchDate: DateTime
- expiryDate: DateTime
- initialQty: Int (opening quantity)
- remainingQty: Int (current available)
- unit: String (derived from ingredient)
- qrCodeValue: String (FNBBATCH:<batchCode>)
- printedLabelCount: Int (sequential counter)
- labelCreatedAt: DateTime (last label print time)
- isLocked: Boolean (soft lock to prevent modifications)
- createdBy: String (user ID)
- createdAt: DateTime
- updatedAt: DateTime
```

**Key Fields:**
- `batchCode`: Unique identifier for scanning
- `qrCodeValue`: Base QR code for batch
- `printedLabelCount`: Ensures sequential label numbering
- `isLocked`: Prevents accidental batch modifications
- `remainingQty`: Updated by consume/transfer operations

#### `BatchLabel`
```prisma
- id: String (UUID, primary)
- batchId: String (foreign key)
- labelNumber: Int (sequential from printedLabelCount)
- qrCodeValue: String (unique QR per label)
- isPrinted: Boolean
- printedAt: DateTime (nullable)
- printedBy: String (user ID)
- createdAt: DateTime
```

**Purpose:** Track individual label printing and provide unique QR per label

#### `StockAdjustment`
```prisma
- id: String (UUID, primary)
- batchId: String (foreign key)
- adjustmentType: String (CONSUME, WASTE, DAMAGE, CORRECTION, INVENTORY_CORRECTION)
- quantityAdjusted: Int
- reason: String
- notes: String
- adjustedBy: String (user ID)
- adjustedAt: DateTime
- createdAt: DateTime
```

**Purpose:** Maintain full audit trail of inventory adjustments

### Scan Operations

#### `ScanLog`
```prisma
- id: String (UUID, primary)
- batchId: String (foreign key)
- storeId: String (foreign key)
- userId: String (user ID, nullable)
- operationType: String (CONSUME, TRANSFER, RECEIVE)
- status: String (SUCCESS, WARNING, ERROR)
- quantityScanned: Int
- remarks: String
- errorMessage: String (nullable)
- deviceId: String (nullable)
- scannedAt: DateTime
- createdAt: DateTime
```

**Notes:**
- `operationType`: Type of operation performed
- `status`: Result of validation (FIFO, expiry, etc)
- Used for stock board aggregation

#### `Device`
```prisma
- id: String (UUID, primary)
- deviceId: String (unique hardware identifier)
- storeId: String (foreign key)
- lastSeenAt: DateTime
- lastSeenIp: String
- createdAt: DateTime
- updatedAt: DateTime
```

**Purpose:** Track scanning device locations and activity

### Transfer Operations

#### `StockTransfer`
```prisma
- id: String (UUID, primary)
- sourceStoreId: String (foreign key)
- destinationStoreId: String (foreign key)
- ingredientBatchId: String (foreign key)
- quantitySent: Int
- quantityReceived: Int (nullable, filled when RECEIVED)
- status: String (IN_TRANSIT, RECEIVED, CANCELLED)
- varianceNotes: String (nullable)
- sentBy: String (user ID)
- sentAt: DateTime
- receivedBy: String (user ID, nullable)
- receivedAt: DateTime (nullable)
- createdAt: DateTime
- updatedAt: DateTime
```

**Workflow:**
1. MANAGER at source store sends batch → `status = IN_TRANSIT`
2. MANAGER at destination store receives → `status = RECEIVED`
3. System updates batch location to destination store

#### `TransferLog`
```prisma
- id: String (UUID, primary)
- transferId: String (foreign key)
- action: String (SENT, RECEIVED, CANCELLED)
- performedBy: String (user ID)
- performedAt: DateTime
```

**Purpose:** Audit trail for all transfer state changes

### Work & Payroll

#### `WorkSchedule`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- year: Int
- month: Int
- status: String (DRAFT, FINALIZED)
- createdBy: String (user ID)
- createdAt: DateTime
- updatedAt: DateTime
```

**Key:** Unique constraint on (storeId, year, month)

#### `WorkScheduleShift`
```prisma
- id: String (UUID, primary)
- scheduleId: String (foreign key)
- shiftName: String (Ca 1, Ca 2, Ca 3)
- startTime: String (HH:mm format)
- endTime: String (HH:mm format)
- sortOrder: Int
```

#### `WorkScheduleEmployee`
```prisma
- id: String (UUID, primary)
- scheduleId: String (foreign key)
- userId: String (foreign key)
- employeeName: String
- probationRate: Decimal (hourly/daily rate for probation)
- regularRate: Decimal (hourly/daily rate for regular)
- allowanceAmount: Decimal
- lateMinutes: Int (total minutes late)
- earlyLeaveMinutes: Int (total minutes early)
```

**Purpose:** Store rates and adjustments for single month

#### `WorkScheduleEntry`
```prisma
- id: String (UUID, primary)
- employeeId: String (foreign key to WorkScheduleEmployee)
- shiftId: String (foreign key)
- date: DateTime
- status: String (PRESENT, ABSENT, LEAVE, HOLIDAY)
- notes: String
```

**Purpose:** Daily attendance record

#### `Payroll`
```prisma
- id: String (UUID, primary)
- scheduleId: String (foreign key)
- userId: String (foreign key)
- grossAmount: Decimal
- deductions: Decimal
- netAmount: Decimal
- calculatedAt: DateTime
```

**Purpose:** Final payroll calculation per employee per month

### POS Integration

#### `PosProduct`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- externalProductId: String (POS system ID)
- name: String
- category: String
- price: Decimal
- createdAt: DateTime
- updatedAt: DateTime
```

#### `PosRecipe`
```prisma
- id: String (UUID, primary)
- productId: String (foreign key)
- ingredientId: String (foreign key)
- quantity: Decimal
- unit: String
```

**Purpose:** Map ingredients to products for reconciliation

#### `PosSales`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- productId: String (foreign key)
- date: DateTime
- quantity: Int
- amount: Decimal
- source: String (imported)
```

### Anomaly Detection

#### `Anomaly`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- businessDate: DateTime
- alertType: String (OVERAGE, SHORTAGE, UNUSUAL_PATTERN)
- severity: String (CRITICAL, WARNING, INFO)
- message: String
- details: JSON
- isResolved: Boolean
- resolvedBy: String (user ID, nullable)
- resolvedAt: DateTime (nullable)
- createdAt: DateTime
```

**Purpose:** Track fraud/waste anomalies for investigation

### Stock Board Layout

#### `IngredientStockLayout`
```prisma
- id: String (UUID, primary)
- storeId: String (foreign key)
- operationType: String (CONSUME, TRANSFER)
- layout: JSON (display configuration)
- createdBy: String (user ID)
- createdAt: DateTime
- updatedAt: DateTime
```

**Key:** Unique constraint on (storeId, operationType)

#### `IngredientStockLayoutGroup`
```prisma
- id: String (UUID, primary)
- layoutId: String (foreign key)
- ingredientGroupId: String (foreign key)
- sortOrder: Int
- isVisible: Boolean
```

#### `IngredientStockLayoutItem`
```prisma
- id: String (UUID, primary)
- groupId: String (foreign key)
- ingredientId: String (foreign key)
- sortOrder: Int
- isVisible: Boolean
```

### Configuration

#### `AppConfig`
```prisma
- id: String (UUID, primary)
- key: String (unique)
- value: String (JSON-serialized)
- description: String
- updatedBy: String (user ID)
- updatedAt: DateTime
```

**Purpose:** Application-wide settings

**Example Keys:**
- `print_labels_per_page`: 10
- `print_label_columns`: 5
- `print_label_rows`: 2
- `business_date_format`: YYYY-MM-DD
- `currency`: VND

## Data Relationships

```
User (1) ─── (N) AuditLog
       ├─── (0..1) Store
       ├─── (N) StockAdjustment
       └─── (N) ScanLog

Store (1) ─── (N) StoreNetworkWhitelist
      ├─── (N) User
      ├─── (N) IngredientBatch
      ├─── (N) ScanLog
      ├─── (N) WorkSchedule
      ├─── (N) StockTransfer (sourceStore)
      ├─── (N) StockTransfer (destinationStore)
      └─── (N) Device

IngredientGroup (1) ─── (N) Ingredient
                   └─── (N) IngredientStockLayoutGroup

IngredientUnit (1) ─── (N) Ingredient

Ingredient (1) ─── (N) IngredientBatch
           ├─── (N) StockAdjustment
           └─── (N) PosRecipe

IngredientBatch (1) ─── (N) BatchLabel
                 ├─── (N) ScanLog
                 ├─── (N) StockAdjustment
                 └─── (1) StockTransfer

WorkSchedule (1) ─── (N) WorkScheduleShift
             ├─── (N) WorkScheduleEmployee
             └─── (N) Payroll

WorkScheduleEmployee (1) ─── (N) WorkScheduleEntry

PosProduct (1) ─── (N) PosRecipe
           └─── (N) PosSales
```

## Migration Strategy

### Development
- Use `npm run prisma:migrate:dev` for local schema changes
- Test migrations locally before commit
- Commit migration files to version control

### Staging
- Use `npm run prisma:migrate:deploy` on first deploy
- Verify no data loss
- Test all operations in staging

### Production
- Create backup before migration
- Use `npm run prisma:migrate:deploy`
- Monitor application after migration
- Keep rollback plan ready

## Performance Considerations

### Indexes (Auto by Prisma)
- Primary keys: All tables
- Foreign keys: Automatic
- Unique fields: username, email, code, deviceId

### Manual Indexes to Consider
```sql
-- Stock board queries
CREATE INDEX idx_scan_log_store_date ON "ScanLog"("storeId", "scannedAt");
CREATE INDEX idx_scan_log_batch_date ON "ScanLog"("batchId", "scannedAt");

-- Batch lookups
CREATE INDEX idx_batch_code_store ON "IngredientBatch"("batchCode", "storeId");

-- Transfer lookups
CREATE INDEX idx_transfer_status ON "StockTransfer"("status", "createdAt");

-- User lookups
CREATE INDEX idx_user_store ON "User"("storeId", "role");
```

## Backup Strategy

- **Daily backups**: 14 retained
- **Weekly backups**: 8 retained  
- **Monthly backups**: 3 retained

Use scripts: `deploy/scripts/backup-postgres.ps1` and `restore-postgres.ps1`

## Security Notes

- All passwords stored as hash (bcrypt)
- No sensitive data in audit logs
- User IDs used instead of names in most tables
- Timestamps in UTC
- Soft deletes via `isActive` flag where applicable

## Future Enhancements

- Add database views for common reports
- Implement data archival strategy for old records
- Add materialized views for performance
- Consider data warehouse for analytics
