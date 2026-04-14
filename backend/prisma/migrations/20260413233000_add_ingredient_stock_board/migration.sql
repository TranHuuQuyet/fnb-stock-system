CREATE TABLE "IngredientGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ingredient" ADD COLUMN "groupId" TEXT;

INSERT INTO "IngredientGroup" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    'ingredient-group-ungrouped',
    'Chưa phân loại',
    'chua phan loai',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "IngredientGroup"
    WHERE "normalizedName" = 'chua phan loai'
);

UPDATE "Ingredient"
SET "groupId" = (
    SELECT "id"
    FROM "IngredientGroup"
    WHERE "normalizedName" = 'chua phan loai'
    LIMIT 1
)
WHERE "groupId" IS NULL;

ALTER TABLE "Ingredient" ALTER COLUMN "groupId" SET NOT NULL;

CREATE TABLE "IngredientStockLayout" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "operationType" "ScanOperationType" NOT NULL DEFAULT 'STORE_USAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientStockLayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IngredientStockLayoutGroup" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientStockLayoutGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IngredientStockLayoutItem" (
    "id" TEXT NOT NULL,
    "layoutGroupId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientStockLayoutItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngredientGroup_normalizedName_key" ON "IngredientGroup"("normalizedName");
CREATE INDEX "IngredientGroup_createdAt_idx" ON "IngredientGroup"("createdAt");

CREATE INDEX "Ingredient_groupId_idx" ON "Ingredient"("groupId");

CREATE UNIQUE INDEX "IngredientStockLayout_storeId_operationType_key" ON "IngredientStockLayout"("storeId", "operationType");
CREATE INDEX "IngredientStockLayout_storeId_operationType_idx" ON "IngredientStockLayout"("storeId", "operationType");

CREATE UNIQUE INDEX "IngredientStockLayoutGroup_layoutId_groupId_key" ON "IngredientStockLayoutGroup"("layoutId", "groupId");
CREATE INDEX "IngredientStockLayoutGroup_layoutId_sortOrder_idx" ON "IngredientStockLayoutGroup"("layoutId", "sortOrder");
CREATE INDEX "IngredientStockLayoutGroup_groupId_idx" ON "IngredientStockLayoutGroup"("groupId");

CREATE UNIQUE INDEX "IngredientStockLayoutItem_layoutGroupId_ingredientId_key" ON "IngredientStockLayoutItem"("layoutGroupId", "ingredientId");
CREATE INDEX "IngredientStockLayoutItem_layoutGroupId_sortOrder_idx" ON "IngredientStockLayoutItem"("layoutGroupId", "sortOrder");
CREATE INDEX "IngredientStockLayoutItem_ingredientId_idx" ON "IngredientStockLayoutItem"("ingredientId");

ALTER TABLE "Ingredient"
ADD CONSTRAINT "Ingredient_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "IngredientGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IngredientStockLayout"
ADD CONSTRAINT "IngredientStockLayout_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockLayoutGroup"
ADD CONSTRAINT "IngredientStockLayoutGroup_layoutId_fkey"
FOREIGN KEY ("layoutId") REFERENCES "IngredientStockLayout"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockLayoutGroup"
ADD CONSTRAINT "IngredientStockLayoutGroup_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "IngredientGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IngredientStockLayoutItem"
ADD CONSTRAINT "IngredientStockLayoutItem_layoutGroupId_fkey"
FOREIGN KEY ("layoutGroupId") REFERENCES "IngredientStockLayoutGroup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IngredientStockLayoutItem"
ADD CONSTRAINT "IngredientStockLayoutItem_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
