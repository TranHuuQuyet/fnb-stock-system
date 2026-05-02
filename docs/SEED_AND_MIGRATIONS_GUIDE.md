# 🌱 Seed.ts & Migrations Explained

## 📋 Overview

The seeding system consists of two parts:

1. **Migrations** (`backend/prisma/migrations/`) - Database schema changes (versioned)
2. **Seed Script** (`backend/prisma/seed.ts`) - Initial demo data (idempotent)

---

## 🗂️ Migrations Structure

### **Location:**
```
backend/prisma/migrations/
├── 20260408010000_init/              ← Initial schema (all tables)
├── 20260410093000_add_batch_label_sequence/
├── 20260410113000_add_scan_transfer_operation/
├── 20260410140000_add_user_permissions/
├── 20260410233000_add_ingredient_units/
├── 20260411103000_add_store_network_bypass/
├── 20260413170000_add_work_schedules/
├── 20260413233000_add_ingredient_stock_board/
├── 20260414213000_add_stock_transfers/
├── 20260415093000_add_payroll_fields_to_work_schedule_employee/
├── 20260416093000_add_user_login_lockout/
├── 20260416160000_add_user_session_version/
├── 20260424113000_add_scan_consumed_label_key/
└── migration_lock.toml               ← Provider lock file
```

### **Migration File Naming Convention:**

```
{TIMESTAMP}_{description}/migration.sql

Example: 20260410093000_add_batch_label_sequence
  │       │ │ │ │ │  │ │ │
  │       │ │ │ │ │  │ │ └─ Day
  │       │ │ │ │ │  │ └──── Month
  │       │ │ │ │ │  └─────── Year
  │       │ │ │ │ └────────── Hour
  │       │ │ │ └─────────── Minute
  │       │ │ └──────────── Minute
  │       └──────────────── Date in YYYYMMDDHHMM format
  └─────────────────────── Human-readable description
```

---

## 🔍 Migration Examples

### **1. Initial Migration (20260408010000_init)**

Creates all tables from scratch:

```sql
-- CreateEnum (Enums with constraints)
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'SOFT_LOCKED', 'DEPLETED', 'EXPIRED');
CREATE TYPE "StockAdjustmentType" AS ENUM ('INCREASE', 'DECREASE');
-- ... 10+ more enums

-- CreateTable (Core tables)
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL UNIQUE,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "storeId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'MUST_CHANGE_PASSWORD',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (For query optimization)
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_storeId_idx" ON "User"("storeId");

-- CreateConstraint (Foreign keys)
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" 
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL;
```

**What This Does:**
- ✅ Creates enums with valid values (type-safe)
- ✅ Creates all 20+ tables with proper columns
- ✅ Sets PRIMARY KEYs for unique identification
- ✅ Creates indexes for query performance
- ✅ Establishes FOREIGN KEYs for relationships

---

### **2. Incremental Migration (20260410093000_add_batch_label_sequence)**

Adds a single column to existing table:

```sql
ALTER TABLE "IngredientBatch"
ADD COLUMN "printedLabelCount" INTEGER NOT NULL DEFAULT 0;
```

**Why Incremental?**
- Easy to review (small, focused change)
- Can be rolled back independently
- Tracks all schema evolution

---

### **3. Another Example (20260416160000_add_user_session_version)**

Adds session invalidation support:

```sql
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Now when admin logs out all users, only increment sessionVersion
-- Old tokens become invalid instantly
```

---

## 🌱 Seed File: seed.ts

### **Location:** `backend/prisma/seed.ts`

### **Purpose:**
- ✅ Create demo data for testing/development
- ✅ Idempotent (safe to run multiple times)
- ✅ Uses `upsert` pattern (insert or update)
- ✅ Demonstrates all core features

---

## 📖 Seed.ts Structure

### **1. Helper Functions**

```typescript
// Format date to business date (YYYY-MM-DD)
const toBusinessDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

// Generate QR code value
const batchQr = (batchCode: string) => `FNBBATCH:${batchCode}`;

// Normalize unit names (lowercase, trim spaces)
const normalizeUnit = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

// Normalize group names (remove accents, lowercase)
const normalizeGroupName = (value: string) =>
  value
    .trim()
    .normalize('NFD')                    // Decompose accents
    .replace(/\p{Diacritic}/gu, '')     // Remove diacritics
    .replace(/[đĐ]/g, 'd')               // Normalize special chars
    .toLowerCase();
```

**Why These Helpers?**
- Consistent formatting across database
- Timezone-aware (Vietnam timezone)
- Accent-insensitive searching

---

### **2. Main Seeding Function**

```typescript
async function main() {
  // Password hash (bcrypt with salt=10)
  const passwordHash = await bcrypt.hash('123456', 10);
  const businessDate = toBusinessDate();

  // ===== STEP 1: Create Demo Store =====
  const store = await prisma.store.upsert({
    where: { code: 'STORE-HCM-01' },  // Lookup key (UNIQUE)
    update: {                           // If exists: update
      name: 'Cửa hàng demo FNB',
      isActive: true
    },
    create: {                           // If not exists: create
      code: 'STORE-HCM-01',
      name: 'Cửa hàng demo FNB',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    }
  });

  // ===== STEP 2: Create Demo Users (4 in parallel) =====
  const [admin, manager, staff1, staff2] = await Promise.all([
    // ADMIN user
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {
        fullName: 'Quản trị hệ thống',
        role: UserRole.ADMIN,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: []
      },
      create: {
        username: 'admin',
        fullName: 'Quản trị hệ thống',
        role: UserRole.ADMIN,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: []
      }
    }),
    // MANAGER user
    prisma.user.upsert({
      where: { username: 'manager1' },
      update: { /* ... */ },
      create: { /* ... */ }
    }),
    // STAFF 1 (Active)
    prisma.user.upsert({
      where: { username: 'staff1' },
      update: { status: UserStatus.ACTIVE },
      create: { status: UserStatus.ACTIVE }
    }),
    // STAFF 2 (Must change password)
    prisma.user.upsert({
      where: { username: 'staff2' },
      update: { status: UserStatus.MUST_CHANGE_PASSWORD },
      create: { status: UserStatus.MUST_CHANGE_PASSWORD }
    })
  ]);

  // ===== STEP 3: Create Ingredient Units =====
  await Promise.all(
    ['kg', 'lít'].map((unit) =>
      prisma.ingredientUnit.upsert({
        where: { normalizedName: normalizeUnit(unit) },
        update: { name: unit },
        create: {
          name: unit,
          normalizedName: normalizeUnit(unit)  // For searching
        }
      })
    )
  );

  // ===== STEP 4: Create Ingredient Group =====
  const defaultIngredientGroup = await prisma.ingredientGroup.upsert({
    where: { normalizedName: normalizeGroupName('Chưa phân loại') },
    update: { name: 'Chưa phân loại' },
    create: {
      name: 'Chưa phân loại',
      normalizedName: normalizeGroupName('Chưa phân loại')
    }
  });

  // ===== STEP 5: Create Demo Ingredients =====
  const [tea, milk, sugar] = await Promise.all([
    prisma.ingredient.upsert({
      where: { code: 'TEA-LEAF' },
      update: { name: 'Trà lá', unit: 'kg', isActive: true },
      create: { code: 'TEA-LEAF', name: 'Trà lá', unit: 'kg', isActive: true }
    }),
    prisma.ingredient.upsert({
      where: { code: 'MILK' },
      update: { name: 'Sữa tươi', unit: 'lít', isActive: true },
      create: { code: 'MILK', name: 'Sữa tươi', unit: 'lít', isActive: true }
    }),
    prisma.ingredient.upsert({
      where: { code: 'SUGAR' },
      update: { name: 'Nước đường', unit: 'lít', isActive: true },
      create: { code: 'SUGAR', name: 'Nước đường', unit: 'lít', isActive: true }
    })
  ]);

  // ===== STEP 6: Create Demo Batches (Different statuses) =====
  
  // Batch 1: ACTIVE (ongoing)
  const batchTeaOld = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {        // UNIQUE constraint
        storeId: store.id,
        batchCode: 'BATCH-TRA-001'
      }
    },
    update: {
      remainingQty: 19.9,  // 20 - 0.1 consumed
      status: BatchStatus.ACTIVE
    },
    create: {
      ingredientId: tea.id,
      storeId: store.id,
      batchCode: 'BATCH-TRA-001',
      receivedAt: new Date('2026-04-01T02:00:00.000Z'),
      expiredAt: new Date('2026-05-01T02:00:00.000Z'),
      initialQty: 20,
      remainingQty: 19.9,  // Some already consumed
      status: BatchStatus.ACTIVE,
      qrCodeValue: batchQr('BATCH-TRA-001'),  // For scanning
      qrGeneratedAt: new Date(),
      labelCreatedAt: new Date()
    }
  });

  // Batch 2: ACTIVE (newer batch)
  const batchTeaNew = await prisma.ingredientBatch.upsert({
    where: { storeId_batchCode: { storeId: store.id, batchCode: 'BATCH-TRA-002' } },
    update: { remainingQty: 54.8 },
    create: {
      // ... newer batch with more quantity
      remainingQty: 54.8
    }
  });

  // Batch 3: SOFT_LOCKED (damaged packaging)
  const batchMilkLock = await prisma.ingredientBatch.upsert({
    where: { storeId_batchCode: { storeId: store.id, batchCode: 'BATCH-SUA-LOCK-001' } },
    update: {
      status: BatchStatus.SOFT_LOCKED,
      softLockReason: 'Bao bì bị hỏng'  // Reason for lock
    },
    create: {
      status: BatchStatus.SOFT_LOCKED,
      softLockReason: 'Bao bì bị hỏng',
      remainingQty: 30  // Untouched
    }
  });

  // Batch 4: EXPIRED (past expiry date)
  const batchSugarExpired = await prisma.ingredientBatch.upsert({
    where: { storeId_batchCode: { storeId: store.id, batchCode: 'BATCH-DUONG-EXP-001' } },
    update: { status: BatchStatus.EXPIRED },
    create: {
      status: BatchStatus.EXPIRED,
      expiredAt: new Date('2026-04-05T02:00:00.000Z')  // Already expired
    }
  });

  // Batch 5: DEPLETED (qty = 0)
  const batchSugarDepleted = await prisma.ingredientBatch.upsert({
    where: { storeId_batchCode: { storeId: store.id, batchCode: 'BATCH-DUONG-DEP-001' } },
    update: { remainingQty: 0, status: BatchStatus.DEPLETED },
    create: {
      remainingQty: 0,  // All consumed
      status: BatchStatus.DEPLETED
    }
  });

  // ===== STEP 7: App Config =====
  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {
      allowFifoBypass: true,      // Allow consuming newer batches
      anomalyThreshold: 0.7       // 70% threshold for anomalies
    },
    create: {
      id: 'default',
      allowFifoBypass: true,
      anomalyThreshold: 0.7
    }
  });

  // ===== STEP 8: Network Whitelisting =====
  // Localhost IPs (dev environment)
  const whitelistValues = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '172.17.0.1',              // Docker bridge
    '172.18.0.1',              // Docker compose
    '::ffff:172.17.0.1',
    '::ffff:172.18.0.1'
  ];
  
  for (const value of whitelistValues) {
    await prisma.storeNetworkWhitelist.upsert({
      where: {
        storeId_type_value: {   // UNIQUE constraint
          storeId: store.id,
          type: 'IP',
          value
        }
      },
      update: { isActive: true },
      create: {
        storeId: store.id,
        type: 'IP',             // Type: IP or SSID
        value,
        isActive: true
      }
    });
  }

  // WiFi SSID whitelist
  await prisma.storeNetworkWhitelist.upsert({
    where: {
      storeId_type_value: {
        storeId: store.id,
        type: 'SSID',
        value: 'FNB-DEMO-WIFI'
      }
    },
    update: { isActive: true },
    create: {
      storeId: store.id,
      type: 'SSID',
      value: 'FNB-DEMO-WIFI',
      isActive: true
    }
  });

  // ===== STEP 9: POS Products (Drinks) =====
  const milkTea = await prisma.posProduct.upsert({
    where: { code: 'MILK-TEA' },
    update: { name: 'Trà sữa', isActive: true },
    create: { code: 'MILK-TEA', name: 'Trà sữa', isActive: true }
  });

  const blackTea = await prisma.posProduct.upsert({
    where: { code: 'BLACK-TEA' },
    update: { name: 'Trà đen', isActive: true },
    create: { code: 'BLACK-TEA', name: 'Trà đen', isActive: true }
  });

  // ===== STEP 10: Recipes (Ingredients per product) =====
  // Milk Tea recipe:
  //   - 0.05 kg tea leaf
  //   - 0.1 lít milk
  //   - 0.02 lít sugar syrup
  const recipeEntries = [
    { productId: milkTea.id, ingredientId: tea.id, qtyPerUnit: 0.05 },
    { productId: milkTea.id, ingredientId: milk.id, qtyPerUnit: 0.1 },
    { productId: milkTea.id, ingredientId: sugar.id, qtyPerUnit: 0.02 },
    
    // Black Tea recipe:
    { productId: blackTea.id, ingredientId: tea.id, qtyPerUnit: 0.04 },
    { productId: blackTea.id, ingredientId: sugar.id, qtyPerUnit: 0.01 }
  ];

  for (const entry of recipeEntries) {
    await prisma.recipe.upsert({
      where: {
        productId_ingredientId: {  // UNIQUE constraint
          productId: entry.productId,
          ingredientId: entry.ingredientId
        }
      },
      update: { qtyPerUnit: entry.qtyPerUnit },
      create: entry
    });
  }

  // ===== STEP 11: POS Sales (Today's sales) =====
  await prisma.posSale.upsert({
    where: {
      storeId_productId_businessDate: {  // UNIQUE constraint
        storeId: store.id,
        productId: milkTea.id,
        businessDate: businessDateValue  // Today
      }
    },
    update: { qtySold: 20 },
    create: {
      storeId: store.id,
      productId: milkTea.id,
      businessDate: businessDateValue,
      qtySold: 20  // Sold 20 cups today
    }
  });

  // ===== STEP 12: Stock Adjustments (Sample) =====
  await prisma.stockAdjustment.upsert({
    where: { id: 'stock-adjustment-sample' },
    update: {
      quantity: 5,
      reason: 'Điều chỉnh tồn đầu kỳ'
    },
    create: {
      id: 'stock-adjustment-sample',
      storeId: store.id,
      batchId: batchTeaNew.id,
      adjustmentType: StockAdjustmentType.INCREASE,
      quantity: 5,  // Added 5 units
      reason: 'Điều chỉnh tồn đầu kỳ',
      createdByUserId: admin.id
    }
  });

  // ===== STEP 13: Scan Logs (Sample) =====
  await prisma.scanLog.upsert({
    where: {
      clientEventId: '11111111-1111-4111-8111-111111111111'  // UNIQUE
    },
    update: {
      resultStatus: ScanResultStatus.SUCCESS
    },
    create: {
      clientEventId: '11111111-1111-4111-8111-111111111111',
      storeId: store.id,
      userId: staff1.id,
      deviceId: 'device-demo-001',
      batchId: batchTeaOld.id,
      quantityUsed: 0.1,  // 0.1 kg consumed
      scannedAt: new Date(),
      receivedAt: new Date(),
      source: ScanSource.ONLINE,
      entryMethod: ScanEntryMethod.CAMERA,
      resultStatus: ScanResultStatus.SUCCESS,
      resultCode: 'SCAN_OK'
    }
  });

  console.log('✅ Database seed completed successfully!');
}
```

---

## 🔄 How Upsert Works (Idempotent)

```typescript
// First run: Creates new record
const store = await prisma.store.upsert({
  where: { code: 'STORE-HCM-01' },  // Look for existing
  update: { /* ... */ },             // If found: update this
  create: { /* ... */ }              // If not found: create with this
});

// Runs 1: Creates ✅
// Runs 2: Updates (not duplicate) ✅
// Runs 3: Updates (idempotent) ✅
// Safe to run multiple times!
```

**Why Upsert?**
- ✅ Safe to run `npm run db:seed` multiple times
- ✅ Updates existing demo data if schema changes
- ✅ No duplicate errors

---

## 🚀 Running Migrations & Seeds

### **Step 1: Create Migration**
```bash
# After editing schema.prisma
npx prisma migrate dev --name descriptive_name

# This:
# 1. Creates new migration file
# 2. Applies migration to DB
# 3. Regenerates types
# 4. Runs seed.ts
```

### **Step 2: Apply to Existing DB**
```bash
# Production deployment
npx prisma migrate deploy

# This:
# 1. Reads all unapplied migrations
# 2. Executes them in order
# 3. Records in _prisma_migrations table
```

### **Step 3: Seed Only**
```bash
npm run db:seed
# or
npx prisma db seed

# Runs seed.ts (idempotent)
```

### **Step 4: Reset (Dev Only)**
```bash
npm run db:reset

# This:
# 1. DROPS entire database
# 2. Runs all migrations
# 3. Runs seed.ts
# ⚠️ DESTRUCTIVE - DEV ONLY!
```

---

## 📊 Migration Tracking Table

Prisma automatically creates `_prisma_migrations` table:

```sql
SELECT * FROM "_prisma_migrations";

-- Output:
-- id                | checksum        | finished_at         | migration_name              | logs | rolled_back_at | started_at | execution_time
-- 1                 | hash1           | 2026-04-08 10:00:00 | 20260408010000_init         |      |                |            | 1234
-- 2                 | hash2           | 2026-04-10 09:30:00 | 20260410093000_add_batch... |      |                |            | 567
```

This prevents applying same migration twice.

---

## 🎯 Schema Evolution Example

### **Timeline:**

```
April 8, 2026: Initial schema (30+ tables)
  └─ migration.sql (2000+ lines)

April 10, 2026: Add batch label sequence
  └─ ALTER TABLE ADD COLUMN printedLabelCount

April 11, 2026: Add store network bypass
  └─ ALTER TABLE ADD COLUMN networkBypassEnabled
  └─ ALTER TABLE ADD COLUMN networkBypassExpiresAt

April 16, 2026: Add user session version (for instant logout)
  └─ ALTER TABLE ADD COLUMN sessionVersion

April 24, 2026: Add scan consumed label key
  └─ ALTER TABLE ADD COLUMN consumedLabelKey
```

Each migration is independent and can be rolled back.

---

## 📝 package.json Scripts

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force"
  }
}
```

---

## ✅ Common Seed Patterns

### **Pattern 1: Upsert (Safe)**
```typescript
await prisma.model.upsert({
  where: { uniqueField: 'value' },
  update: { /* update if exists */ },
  create: { /* create if not exists */ }
});
```

### **Pattern 2: Parallel Operations**
```typescript
const [user1, user2, user3] = await Promise.all([
  prisma.user.upsert(...),
  prisma.user.upsert(...),
  prisma.user.upsert(...)
]);
```

### **Pattern 3: Relationships**
```typescript
// Create store first
const store = await prisma.store.upsert({...});

// Then create user referencing store
const user = await prisma.user.upsert({
  create: {
    storeId: store.id  // Reference created store
  }
});
```

### **Pattern 4: Bulk Updates**
```typescript
for (const item of items) {
  await prisma.model.upsert({
    where: { id: item.id },
    update: item,
    create: item
  });
}
```

---

## 🔐 Demo Data Security

```typescript
// Password: "123456" (demo only)
const passwordHash = await bcrypt.hash('123456', 10);

// bcrypt with salt=10:
// - Slow (takes ~100ms per hash)
// - Cannot reverse
// - Salt prevents rainbow tables
// ⚠️ ONLY for demo! Change in production!
```

**Demo Credentials:**
| Username | Password | Role |
|----------|----------|------|
| admin | 123456 | Admin |
| manager1 | 123456 | Manager |
| staff1 | 123456 | Staff (Active) |
| staff2 | 123456 | Staff (Must change PW) |

---

## 📋 Summary

| Component | Purpose | When to Use |
|-----------|---------|------------|
| **Migrations** | Schema versioning | After editing `schema.prisma` |
| **Seed.ts** | Demo data | First setup or reset |
| **migrate:dev** | Local dev workflow | During development |
| **migrate:deploy** | Production update | CI/CD pipeline |
| **db:reset** | Full reset | Dev environment only |

Both work together:
- Migrations = **Structure** (how tables are organized)
- Seeds = **Content** (demo data to start with)

