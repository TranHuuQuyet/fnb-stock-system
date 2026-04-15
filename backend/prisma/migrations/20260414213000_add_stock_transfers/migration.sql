CREATE TYPE "StockTransferStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED');

CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "sourceStoreId" TEXT NOT NULL,
    "destinationStoreId" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "destinationBatchId" TEXT,
    "ingredientId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "quantityRequested" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmationNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockTransfer_sourceStoreId_requestedAt_idx" ON "StockTransfer"("sourceStoreId", "requestedAt");
CREATE INDEX "StockTransfer_destinationStoreId_status_requestedAt_idx" ON "StockTransfer"("destinationStoreId", "status", "requestedAt");
CREATE INDEX "StockTransfer_status_requestedAt_idx" ON "StockTransfer"("status", "requestedAt");
CREATE INDEX "StockTransfer_batchCode_requestedAt_idx" ON "StockTransfer"("batchCode", "requestedAt");

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_sourceStoreId_fkey"
FOREIGN KEY ("sourceStoreId") REFERENCES "Store"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_destinationStoreId_fkey"
FOREIGN KEY ("destinationStoreId") REFERENCES "Store"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_sourceBatchId_fkey"
FOREIGN KEY ("sourceBatchId") REFERENCES "IngredientBatch"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_destinationBatchId_fkey"
FOREIGN KEY ("destinationBatchId") REFERENCES "IngredientBatch"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
ADD CONSTRAINT "StockTransfer_confirmedByUserId_fkey"
FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
