-- AddColumn permissions to User
ALTER TABLE "User"
ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
