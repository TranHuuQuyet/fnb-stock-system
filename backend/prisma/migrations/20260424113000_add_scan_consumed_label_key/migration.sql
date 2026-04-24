ALTER TABLE "ScanLog"
ADD COLUMN "scannedLabelValue" TEXT,
ADD COLUMN "consumedLabelKey" TEXT;

CREATE UNIQUE INDEX "ScanLog_consumedLabelKey_key" ON "ScanLog"("consumedLabelKey");
