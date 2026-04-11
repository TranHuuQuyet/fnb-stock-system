ALTER TABLE "Store"
ADD COLUMN "networkBypassEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "networkBypassExpiresAt" TIMESTAMP(3),
ADD COLUMN "networkBypassReason" TEXT;

CREATE INDEX "Store_networkBypassEnabled_networkBypassExpiresAt_idx"
ON "Store"("networkBypassEnabled", "networkBypassExpiresAt");
