-- CreateTable
CREATE TABLE "IngredientUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientUnit_normalizedName_key" ON "IngredientUnit"("normalizedName");

-- CreateIndex
CREATE INDEX "IngredientUnit_createdAt_idx" ON "IngredientUnit"("createdAt");

-- Seed distinct legacy units from existing ingredients
INSERT INTO "IngredientUnit" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    'legacy-unit-' || md5(lower(regexp_replace(trim("unit"), '\s+', ' ', 'g'))),
    regexp_replace(trim("unit"), '\s+', ' ', 'g') AS "name",
    lower(regexp_replace(trim("unit"), '\s+', ' ', 'g')) AS "normalizedName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Ingredient"
WHERE char_length(trim("unit")) > 0
GROUP BY 2, 3
ON CONFLICT ("normalizedName") DO NOTHING;
