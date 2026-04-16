ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN "lockoutUntil" TIMESTAMP(3);

CREATE INDEX "User_lockoutUntil_idx" ON "User"("lockoutUntil");
