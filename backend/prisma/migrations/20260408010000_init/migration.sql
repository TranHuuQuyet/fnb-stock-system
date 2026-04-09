-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'MUST_CHANGE_PASSWORD');

-- CreateEnum
CREATE TYPE "NetworkWhitelistType" AS ENUM ('IP', 'SSID');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'SOFT_LOCKED', 'DEPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StockAdjustmentType" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "ScanSource" AS ENUM ('ONLINE', 'OFFLINE_SYNC', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "ScanResultStatus" AS ENUM ('SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ScanEntryMethod" AS ENUM ('CAMERA', 'MANUAL');

-- CreateEnum
CREATE TYPE "FraudAttemptType" AS ENUM ('NETWORK_RESTRICTED', 'INVALID_QR', 'UNKNOWN_BATCH');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreNetworkWhitelist" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "NetworkWhitelistType" NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreNetworkWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "storeId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientBatch" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "expiredAt" TIMESTAMP(3),
    "initialQty" DOUBLE PRECISION NOT NULL,
    "remainingQty" DOUBLE PRECISION NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "softLockReason" TEXT,
    "qrCodeValue" TEXT,
    "qrGeneratedAt" TIMESTAMP(3),
    "labelCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "adjustmentType" "StockAdjustmentType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "source" "ScanSource" NOT NULL,
    "entryMethod" "ScanEntryMethod" NOT NULL DEFAULT 'CAMERA',
    "ipAddress" TEXT NOT NULL,
    "ssid" TEXT,
    "resultStatus" "ScanResultStatus" NOT NULL,
    "resultCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "duplicated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAttemptLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "ssid" TEXT,
    "attemptType" "FraudAttemptType" NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudAttemptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "qtySold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyAlert" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "expectedQty" DOUBLE PRECISION NOT NULL,
    "actualQty" DOUBLE PRECISION NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "allowFifoBypass" BOOLEAN NOT NULL DEFAULT true,
    "anomalyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_storeId_idx" ON "User"("storeId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE INDEX "Store_createdAt_idx" ON "Store"("createdAt");

-- CreateIndex
CREATE INDEX "StoreNetworkWhitelist_storeId_type_idx" ON "StoreNetworkWhitelist"("storeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StoreNetworkWhitelist_storeId_type_value_key" ON "StoreNetworkWhitelist"("storeId", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- CreateIndex
CREATE INDEX "Device_storeId_idx" ON "Device"("storeId");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_code_key" ON "Ingredient"("code");

-- CreateIndex
CREATE INDEX "Ingredient_createdAt_idx" ON "Ingredient"("createdAt");

-- CreateIndex
CREATE INDEX "IngredientBatch_storeId_status_receivedAt_idx" ON "IngredientBatch"("storeId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "IngredientBatch_ingredientId_storeId_receivedAt_idx" ON "IngredientBatch"("ingredientId", "storeId", "receivedAt");

-- CreateIndex
CREATE INDEX "IngredientBatch_createdAt_idx" ON "IngredientBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientBatch_storeId_batchCode_key" ON "IngredientBatch"("storeId", "batchCode");

-- CreateIndex
CREATE INDEX "StockAdjustment_storeId_createdAt_idx" ON "StockAdjustment"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_batchId_createdAt_idx" ON "StockAdjustment"("batchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScanLog_clientEventId_key" ON "ScanLog"("clientEventId");

-- CreateIndex
CREATE INDEX "ScanLog_storeId_createdAt_idx" ON "ScanLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanLog_userId_createdAt_idx" ON "ScanLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanLog_batchId_idx" ON "ScanLog"("batchId");

-- CreateIndex
CREATE INDEX "ScanLog_scannedAt_idx" ON "ScanLog"("scannedAt");

-- CreateIndex
CREATE INDEX "FraudAttemptLog_storeId_createdAt_idx" ON "FraudAttemptLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "FraudAttemptLog_userId_createdAt_idx" ON "FraudAttemptLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PosProduct_code_key" ON "PosProduct"("code");

-- CreateIndex
CREATE INDEX "PosProduct_createdAt_idx" ON "PosProduct"("createdAt");

-- CreateIndex
CREATE INDEX "Recipe_productId_idx" ON "Recipe"("productId");

-- CreateIndex
CREATE INDEX "Recipe_ingredientId_idx" ON "Recipe"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_ingredientId_key" ON "Recipe"("productId", "ingredientId");

-- CreateIndex
CREATE INDEX "PosSale_storeId_businessDate_idx" ON "PosSale"("storeId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_storeId_productId_businessDate_key" ON "PosSale"("storeId", "productId", "businessDate");

-- CreateIndex
CREATE INDEX "AnomalyAlert_storeId_businessDate_idx" ON "AnomalyAlert"("storeId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyAlert_storeId_businessDate_ingredientId_key" ON "AnomalyAlert"("storeId", "businessDate", "ingredientId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreNetworkWhitelist" ADD CONSTRAINT "StoreNetworkWhitelist_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientBatch" ADD CONSTRAINT "IngredientBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientBatch" ADD CONSTRAINT "IngredientBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngredientBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngredientBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAttemptLog" ADD CONSTRAINT "FraudAttemptLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAttemptLog" ADD CONSTRAINT "FraudAttemptLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyAlert" ADD CONSTRAINT "AnomalyAlert_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyAlert" ADD CONSTRAINT "AnomalyAlert_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
