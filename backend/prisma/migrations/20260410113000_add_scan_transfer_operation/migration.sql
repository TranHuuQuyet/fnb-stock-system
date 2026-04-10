CREATE TYPE "ScanOperationType" AS ENUM ('STORE_USAGE', 'TRANSFER');

ALTER TABLE "ScanLog"
ADD COLUMN "destinationStoreId" TEXT,
ADD COLUMN "operationType" "ScanOperationType" NOT NULL DEFAULT 'STORE_USAGE';

CREATE INDEX "ScanLog_destinationStoreId_createdAt_idx" ON "ScanLog"("destinationStoreId", "createdAt");
CREATE INDEX "ScanLog_operationType_createdAt_idx" ON "ScanLog"("operationType", "createdAt");

ALTER TABLE "ScanLog"
ADD CONSTRAINT "ScanLog_destinationStoreId_fkey"
FOREIGN KEY ("destinationStoreId") REFERENCES "Store"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
