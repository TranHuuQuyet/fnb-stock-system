# 🔍 ACID Embedded Queries - Locations & Examples

## 📍 Where to Find ACID Transactions in the Codebase

All **ACID-compliant transactions** use the `runInTransaction()` wrapper defined in PrismaService. Below are all locations where ACID queries are embedded:

---

## 🏗️ Foundation: Transaction Wrapper

### **File:** [backend/src/prisma/prisma.service.ts](../backend/src/prisma/prisma.service.ts)

```typescript
// 🔒 The core transaction wrapper - ALL ACID queries go through this
async runInTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    isolationLevel = Prisma.TransactionIsolationLevel.Serializable,
    maxRetries = PrismaService.DEFAULT_TRANSACTION_RETRIES,
    shouldRetry = (error: unknown) => this.isRetryableTransactionError(error)
  } = options;
  
  for (let attempt = 0; ; attempt += 1) {
    try {
      // BEGIN TRANSACTION with Serializable isolation
      return await this.$transaction(operation, { isolationLevel });
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      // ROLLBACK + RETRY with exponential backoff (25ms, 50ms, 75ms)
      await this.delay((attempt + 1) * 25);
    }
  }
}
```

**ACID Properties Applied:**
- ✅ **Atomicity:** `$transaction()` ensures all-or-nothing
- ✅ **Consistency:** Serializable isolation prevents inconsistent states
- ✅ **Isolation:** Prevents dirty reads, phantom reads
- ✅ **Durability:** PostgreSQL WAL ensures data survives crashes
- ✅ **Retry Logic:** Automatic retry on serialization conflicts (P2034)

---

## 💾 Location 1: Stock Adjustments (Inventory Management)

### **File:** [backend/src/modules/stock-adjustments/stock-adjustments.service.ts](../backend/src/modules/stock-adjustments/stock-adjustments.service.ts)

**Function:** `create()` - Line 34

```typescript
async create(actorUserId: string, batchId: string, dto: CreateStockAdjustmentDto) {
  // 🔒 FETCH OUTSIDE TX (for response display)
  const batch = await this.prisma.ingredientBatch.findUnique({
    where: { id: batchId },
    include: { ingredient: true, store: true }
  });

  // ⚡ CRITICAL TRANSACTION BLOCK - All or nothing
  const result = await this.prisma.runInTransaction(async (tx) => {
    // Step 1: RE-FETCH inside TX (Serializable snapshot)
    const freshBatch = await tx.ingredientBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: { ingredient: true, store: true }
    });

    // Step 2: VALIDATE (Inside TX - prevents race conditions)
    if (
      dto.adjustmentType === StockAdjustmentType.DECREASE &&
      dto.quantity > freshBatch.remainingQty  // ← CHECK constraint enforced here
    ) {
      throw appException(
        HttpStatus.CONFLICT,
        'Adjustment exceeds remaining quantity'
      );
    }

    // Step 3: CALCULATE new quantity
    const nextQty =
      dto.adjustmentType === StockAdjustmentType.INCREASE
        ? freshBatch.remainingQty + dto.quantity
        : freshBatch.remainingQty - dto.quantity;

    // Step 4: UPDATE BATCH (Atomically - or rolls back)
    const updatedBatch = await tx.ingredientBatch.update({
      where: { id: batchId },
      data: {
        remainingQty: nextQty,  // ← Will trigger CHECK (qty >= 0) at DB level
        status: nextQty <= 0 ? BatchStatus.DEPLETED : BatchStatus.ACTIVE
      },
      include: { ingredient: true, store: true }
    });

    // Step 5: CREATE AUDIT RECORD (Or nothing if above fails)
    const adjustment = await tx.stockAdjustment.create({
      data: {
        storeId: freshBatch.storeId,
        batchId,
        adjustmentType: dto.adjustmentType,
        quantity: dto.quantity,
        reason: dto.reason,
        createdByUserId: actorUserId
      }
    });

    return { updatedBatch, adjustment };
  }); // ← END TRANSACTION: COMMIT if success, ROLLBACK if error

  // After successful TX: Log audit trail
  await this.auditService.createLog({
    actorUserId,
    action: 'CREATE_STOCK_ADJUSTMENT',
    entityType: 'StockAdjustment',
    entityId: result.adjustment.id,
    oldData: { batchId, remainingQty: batch.remainingQty },
    newData: { remainingQty: result.updatedBatch.remainingQty }
  });

  return result;
}
```

### **ACID Guarantees Here:**
| Property | Guarantee | Details |
|----------|-----------|---------|
| **Atomicity** | ✅ | Both UPDATE and CREATE succeed or both fail |
| **Consistency** | ✅ | remainingQty >= 0 enforced by CHECK constraint |
| **Isolation** | ✅ | Serializable prevents concurrent adjustment conflicts |
| **Durability** | ✅ | After COMMIT, data survives server crash |

### **SQL Generated (Behind Prisma):**
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Re-fetch with lock
SELECT * FROM "IngredientBatch" WHERE id = 'batch-123';

-- Step 2: Validate (in application code)
IF quantity > remainingQty THEN ROLLBACK;

-- Step 3: Update (atomic)
UPDATE "IngredientBatch"
SET remainingQty = remainingQty - quantity,
    status = CASE WHEN remainingQty - quantity <= 0 THEN 'DEPLETED' ELSE 'ACTIVE' END
WHERE id = 'batch-123';

-- Step 4: Create audit (or rolls back)
INSERT INTO "StockAdjustment" (storeId, batchId, adjustmentType, quantity, reason, createdByUserId)
VALUES (...);

COMMIT; -- Durable!
```

---

## 📊 Location 2: Scan Processing (User Consumption)

### **File:** [backend/src/modules/scan/scan.service.ts](../backend/src/modules/scan/scan.service.ts)

**Function:** `processOnlineScan()` - Line 277

```typescript
const processed = await this.prisma.runInTransaction(async (tx) => {
  // 🔒 Step 1: Re-fetch batch inside TX
  const freshBatch = await tx.ingredientBatch.findUniqueOrThrow({
    where: { id: batch!.id }
  });

  // 🔒 Step 2: Validate fresh state (Serializable snapshot)
  const freshValidationError = await this.validateFreshBatchInTransaction(
    tx,
    params,
    storeId,
    freshBatch,
    ScanOperationType.STORE_USAGE
  );
  if (freshValidationError) {
    return freshValidationError; // ← ROLLBACK, no changes
  }

  // 🔒 Step 3: Check FIFO rule (older batches must be used first)
  const olderBatch = await this.batchesService.findOlderActiveBatch(freshBatch, tx);
  
  if (olderBatch && !config.allowFifoBypass) {
    return this.createErrorLogAndResult(tx, params, {
      storeId,
      batchId: freshBatch.id,
      resultCode: ERROR_CODES.ERROR_FIFO,
      message: 'Must use older batch first (FIFO)'
    }); // ← ROLLBACK
  }

  // 🔒 Step 4: Calculate new quantity
  const nextQty = freshBatch.remainingQty - params.dto.quantityUsed;

  // 🔒 Step 5: UPDATE BATCH (atomic)
  const updatedBatch = await tx.ingredientBatch.update({
    where: { id: freshBatch.id },
    data: {
      remainingQty: nextQty,
      status: nextQty <= 0 ? BatchStatus.DEPLETED : freshBatch.status
    }
  });

  // 🔒 Step 6: CREATE SCAN LOG (audit trail)
  const scanLog = await tx.scanLog.create({
    data: {
      clientEventId: params.dto.clientEventId,  // ← UNIQUE constraint prevents duplicates
      storeId,
      userId: params.userId,
      deviceId: params.deviceId,
      batchId: freshBatch.id,
      quantityUsed: params.dto.quantityUsed,
      scannedAt: params.dto.scannedAt,
      receivedAt: new Date(),
      source: params.source,
      entryMethod: params.dto.entryMethod,
      operationType: ScanOperationType.STORE_USAGE,
      resultStatus: ScanResultStatus.SUCCESS,
      resultCode: ERROR_CODES.SCAN_OK
    }
  });

  // 🔒 Step 7: OPTIONAL - Create deduction record
  const deduction = await tx.batchDeduction.create({
    data: {
      batchId: freshBatch.id,
      deductedQty: params.dto.quantityUsed,
      userId: params.userId,
      reason: 'Store usage scan',
      deductedAt: new Date()
    }
  });

  return { updatedBatch, scanLog, deduction };
}); // ← END TRANSACTION
```

### **ACID Guarantees Here:**
- ✅ **Atomicity:** Update batch + create scan log + create deduction = ALL or NOTHING
- ✅ **Consistency:** Remaining qty never goes negative (CHECK constraint at DB)
- ✅ **Isolation:** Serializable prevents two users consuming from same batch simultaneously
- ✅ **Durability:** FIFO rule enforced at transaction level

### **Key ACID Feature: Deduplication**
```typescript
// UNIQUE constraint prevents duplicate scans
clientEventId: params.dto.clientEventId,  // UNIQUE(clientEventId)
```

If offline sync sends same event twice → 2nd INSERT fails → Transaction rolls back → No duplicate consumption.

---

## 🚚 Location 3: Stock Transfer Confirmation

### **File:** [backend/src/modules/scan/transfers.service.ts](../backend/src/modules/scan/transfers.service.ts)

**Function:** `confirmTransfer()` - Line 206

```typescript
const updated = await this.prisma.runInTransaction(async (tx) => {
  // 🔒 Step 1: Re-fetch transfer inside TX
  const freshTransfer = await tx.stockTransfer.findUnique({
    where: { id: existing.id },
    include: { sourceBatch: true }
  });

  // 🔒 Step 2: Validate not already confirmed
  if (freshTransfer.status === StockTransferStatus.RECEIVED) {
    throw appException(
      HttpStatus.CONFLICT,
      'Transfer already confirmed'
    ); // ← ROLLBACK
  }

  // 🔒 Step 3: Find or create destination batch
  const targetBatch = await tx.ingredientBatch.findUnique({
    where: {
      storeId_batchCode: {
        storeId: freshTransfer.destinationStoreId,
        batchCode: freshTransfer.batchCode
      }
    }
  });

  // 🔒 Step 4: Validate no conflicting batch
  if (targetBatch && targetBatch.ingredientId !== freshTransfer.ingredientId) {
    throw appException(
      HttpStatus.CONFLICT,
      'Destination has conflicting batch'
    ); // ← ROLLBACK
  }

  let destinationBatchId: string | null = targetBatch?.id ?? null;

  // 🔒 Step 5: Create destination batch if needed
  if (dto.receivedQty > 0) {
    if (targetBatch) {
      // Update existing destination batch
      const nextTargetQty = targetBatch.remainingQty + dto.receivedQty;
      
      const updatedTarget = await tx.ingredientBatch.update({
        where: { id: targetBatch.id },
        data: { remainingQty: nextTargetQty }
      });
      destinationBatchId = updatedTarget.id;
    } else {
      // Create new destination batch
      const newTarget = await tx.ingredientBatch.create({
        data: {
          storeId: freshTransfer.destinationStoreId,
          ingredientId: freshTransfer.ingredientId,
          batchCode: freshTransfer.batchCode,
          receivedAt: new Date(),
          initialQty: dto.receivedQty,
          remainingQty: dto.receivedQty,
          status: BatchStatus.ACTIVE
        }
      });
      destinationBatchId = newTarget.id;
    }
  }

  // 🔒 Step 6: Update transfer status (source side)
  const updatedTransfer = await tx.stockTransfer.update({
    where: { id: freshTransfer.id },
    data: {
      status: StockTransferStatus.RECEIVED,
      receivedQty: dto.receivedQty,
      confirmedByUserId: actorUserId,
      destinationBatchId,
      notes: dto.note
    }
  });

  // 🔒 Step 7: Create audit log for transfer
  const auditLog = await tx.auditLog.create({
    data: {
      actorUserId,
      action: 'CONFIRM_TRANSFER',
      entityType: 'StockTransfer',
      entityId: updatedTransfer.id,
      oldData: { status: freshTransfer.status },
      newData: { status: StockTransferStatus.RECEIVED, receivedQty: dto.receivedQty }
    }
  });

  return { updatedTransfer, destinationBatchId, auditLog };
}); // ← END TRANSACTION - All 7 steps or NOTHING
```

### **ACID Guarantees Here:**
| Step | Operation | ACID Property |
|------|-----------|---------------|
| 1-2 | Re-fetch & validate | **Consistency** - Prevent double confirmation |
| 3-4 | Check destination | **Isolation** - Serializable locks conflict detection |
| 5 | Create/update destination batch | **Atomicity** - Both or neither |
| 6 | Update transfer | **Atomicity** - Mark as received |
| 7 | Log audit | **Durability** - Proof of what happened |

---

## 📅 Location 4: Work Schedule Management

### **File:** [backend/src/modules/work-schedules/work-schedules.service.ts](../backend/src/modules/work-schedules/work-schedules.service.ts)

**Function:** `save()` - Line 376

```typescript
const savedSchedule = await this.prisma.runInTransaction(async (tx) => {
  // 🔒 Step 1: Upsert work schedule (create if not exists, update if exists)
  const schedule = await tx.workSchedule.upsert({
    where: {
      storeId_year_month: {  // ← UNIQUE constraint
        storeId: store.id,
        year: dto.year,
        month: dto.month
      }
    },
    update: {
      title: dto.title.trim(),
      notes: dto.notes?.trim() || null,
      status: dto.status ?? existing?.status ?? WorkScheduleStatus.DRAFT
    },
    create: {
      storeId: store.id,
      year: dto.year,
      month: dto.month,
      title: dto.title.trim(),
      notes: dto.notes?.trim() || null,
      status: dto.status ?? WorkScheduleStatus.DRAFT
    }
  });

  // 🔒 Step 2: Delete old schedule entries (atomically)
  if (existing?.employees.length) {
    await tx.workScheduleEntry.deleteMany({
      where: {
        workScheduleEmployeeId: {
          in: existing.employees.map((employee) => employee.id)
        }
      }
    });
  }

  // 🔒 Step 3: Delete old employees
  await tx.workScheduleEmployee.deleteMany({
    where: { workScheduleId: schedule.id }
  });

  // 🔒 Step 4: Delete old shifts
  await tx.workScheduleShift.deleteMany({
    where: { workScheduleId: schedule.id }
  });

  // 🔒 Step 5: Create new employees (bulk insert)
  const newEmployees = await tx.workScheduleEmployee.createMany({
    data: dto.employees.map((emp) => ({
      workScheduleId: schedule.id,
      userId: emp.userId,
      hourlyRate: emp.hourlyRate
    }))
  });

  // 🔒 Step 6: Create new shifts (bulk insert)
  const newShifts = await tx.workScheduleShift.createMany({
    data: dto.shifts.map((shift) => ({
      workScheduleId: schedule.id,
      dayOfMonth: shift.dayOfMonth,
      startTime: shift.startTime,
      endTime: shift.endTime
    }))
  });

  // 🔒 Step 7: Create entries
  const newEntries = await tx.workScheduleEntry.createMany({
    data: dto.entries.map((entry) => ({
      workScheduleEmployeeId: /* employee id */,
      workScheduleShiftId: /* shift id */,
      hoursWorked: entry.hoursWorked,
      status: entry.status
    }))
  });

  return { schedule, newEmployees, newShifts, newEntries };
}); // ← ALL 7 steps commit together or ROLLBACK entirely
```

### **ACID Guarantee: All-or-Nothing Schedule Save**
If any step fails (e.g., invalid employee ID, duplicate shift), the **entire operation rolls back** and the schedule remains in its previous valid state.

---

## 🔧 Location 5: Other Transaction Locations

### **File:** [backend/src/modules/scan/scan.service.ts](../backend/src/modules/scan/scan.service.ts)

Multiple transaction usages:

| Line | Function | Purpose |
|------|----------|---------|
| 277 | `processOnlineScan()` | Online scan + batch update + log creation |
| 455 | `processSyncEvent()` | Offline sync deduplication + create scan log |
| 510 | `createOfflineSyncLog()` | Batch-process offline events atomically |
| 992 | `recordManualScan()` | Manual entry + validation + logging |
| 1100 | `recordQuickConsume()` | Quick consume pattern (pre-issued labels) |
| 1324 | `handleRejectPendingScan()` | Reject scan + revert batch qty |

---

## 📈 Summary: All ACID Query Locations

```
🏗️ Transaction Infrastructure
└── backend/src/prisma/prisma.service.ts (Line 25)
    └── runInTransaction() - The core wrapper

💾 Actual ACID Queries
├── Stock Adjustments
│   └── backend/src/modules/stock-adjustments/stock-adjustments.service.ts (Line 34)
│       └── create() - Update batch + create audit
│
├── Scan Processing (6 different patterns)
│   └── backend/src/modules/scan/scan.service.ts
│       ├── Line 277: processOnlineScan() - Main scan
│       ├── Line 455: processSyncEvent() - Offline sync
│       ├── Line 510: createOfflineSyncLog() - Batch sync
│       ├── Line 992: recordManualScan() - Manual entry
│       ├── Line 1100: recordQuickConsume() - Quick consume
│       └── Line 1324: handleRejectPendingScan() - Rejection
│
├── Stock Transfers
│   └── backend/src/modules/scan/transfers.service.ts (Line 206)
│       └── confirmTransfer() - Bi-directional qty update
│
└── Work Schedules
    └── backend/src/modules/work-schedules/work-schedules.service.ts (Line 376)
        └── save() - Upsert + multi-delete + multi-create
```

---

## 🔍 How to Query for ACID Locations

### **Search All Transaction Uses:**
```bash
# Find all runInTransaction calls
grep -r "runInTransaction" backend/src

# Find all $transaction calls (Prisma batch operations)
grep -r "\$transaction" backend/src
```

### **Identify by Pattern:**

Every ACID query has this structure:

```typescript
const result = await this.prisma.runInTransaction(async (tx) => {
  // 1. Re-fetch inside TX
  const fresh = await tx.TABLE.findUnique({ ... });

  // 2. Validate (inside TX)
  if (invalidCondition) throw error; // ← ROLLBACK

  // 3. Update (atomic)
  await tx.TABLE.update({ ... });

  // 4. Create/log (or nothing)
  await tx.OTHER_TABLE.create({ ... });

  return { ... };
});
```

---

## 📊 Database-Level ACID Verification

### **Check Constraints (Enforced by DB):**
```sql
-- Every IngredientBatch has this constraint
ALTER TABLE "IngredientBatch"
ADD CONSTRAINT qty_non_negative CHECK (remainingQty >= 0);

-- Verify it's working:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'IngredientBatch';
```

### **UNIQUE Constraints (Prevent Duplicates):**
```sql
-- Prevent duplicate batches per store
ALTER TABLE "IngredientBatch"
ADD UNIQUE(storeId, batchCode);

-- Prevent duplicate scans from offline sync
ALTER TABLE "ScanLog"
ADD UNIQUE(clientEventId);
```

### **Transaction Isolation Level:**
```sql
-- Verify Serializable isolation is set:
SELECT name, setting FROM pg_settings 
WHERE name = 'default_transaction_isolation';
-- Should show: serializable
```

---

## ✅ Verification Checklist

Before deployment, verify:

- [ ] All state-changing operations use `runInTransaction()`
- [ ] No direct `await this.prisma.MODEL.update()` without TX
- [ ] All transactions re-fetch inside TX (Serializable snapshot)
- [ ] All validations happen inside TX (prevents race conditions)
- [ ] All error conditions throw before any mutations
- [ ] Audit logs created only on successful TX
- [ ] Database constraints enforced at DB level (CHECK, UNIQUE, FK)
- [ ] Indexes created for query performance
- [ ] Connection pooling configured
- [ ] Automatic retry for P2034 working

---

## 🚀 Next Steps

To understand each transaction in depth:

1. **Read** [docs/TECHNICAL_IMPLEMENTATION.md](TECHNICAL_IMPLEMENTATION.md) - High-level overview
2. **Study** the code files above - Line numbers provided
3. **Run tests** - `npm run test` to see transactions in action
4. **Monitor** - Watch transaction logs in production: `SELECT * FROM pg_stat_statements WHERE query LIKE '%BEGIN%'`

