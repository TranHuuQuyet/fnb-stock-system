-- CreateEnum
CREATE TYPE "WorkScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED');

-- CreateEnum
CREATE TYPE "WorkEntryType" AS ENUM ('TRIAL', 'OFFICIAL');

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "WorkScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleShift" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleEmployee" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "trialHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "officialHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleEntry" (
    "id" TEXT NOT NULL,
    "workScheduleEmployeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "entryType" "WorkEntryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_storeId_year_month_key" ON "WorkSchedule"("storeId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleShift_workScheduleId_key_key" ON "WorkScheduleShift"("workScheduleId", "key");

-- CreateIndex
CREATE INDEX "WorkScheduleShift_workScheduleId_sortOrder_idx" ON "WorkScheduleShift"("workScheduleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleEmployee_workScheduleId_userId_key" ON "WorkScheduleEmployee"("workScheduleId", "userId");

-- CreateIndex
CREATE INDEX "WorkScheduleEmployee_workScheduleId_sortOrder_idx" ON "WorkScheduleEmployee"("workScheduleId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkScheduleEmployee_userId_idx" ON "WorkScheduleEmployee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleEntry_workScheduleEmployeeId_shiftId_day_key" ON "WorkScheduleEntry"("workScheduleEmployeeId", "shiftId", "day");

-- CreateIndex
CREATE INDEX "WorkScheduleEntry_shiftId_day_idx" ON "WorkScheduleEntry"("shiftId", "day");

-- CreateIndex
CREATE INDEX "WorkScheduleEntry_workScheduleEmployeeId_day_idx" ON "WorkScheduleEntry"("workScheduleEmployeeId", "day");

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleShift" ADD CONSTRAINT "WorkScheduleShift_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEmployee" ADD CONSTRAINT "WorkScheduleEmployee_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEmployee" ADD CONSTRAINT "WorkScheduleEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_workScheduleEmployeeId_fkey" FOREIGN KEY ("workScheduleEmployeeId") REFERENCES "WorkScheduleEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkScheduleShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
