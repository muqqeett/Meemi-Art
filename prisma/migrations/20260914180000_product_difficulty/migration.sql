-- CreateTable
CREATE TABLE "ProductDifficulty" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stitches" INTEGER NOT NULL,
    "construction" INTEGER NOT NULL,
    "shaping" INTEGER NOT NULL,
    "colorwork" INTEGER NOT NULL,
    "assembly" INTEGER NOT NULL,
    "patternReading" INTEGER NOT NULL,
    "minutesMin" INTEGER NOT NULL,
    "minutesMax" INTEGER NOT NULL,
    "techniques" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDifficulty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDifficulty_productId_key" ON "ProductDifficulty"("productId");

-- AddForeignKey
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints
-- Not modelled by Prisma. Zod (lib/validations/admin.ts) is the first line of
-- validation; these guarantee the ranges hold even for a write that bypasses it.
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_stitches_range" CHECK ("stitches" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_construction_range" CHECK ("construction" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_shaping_range" CHECK ("shaping" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_colorwork_range" CHECK ("colorwork" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_assembly_range" CHECK ("assembly" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_patternReading_range" CHECK ("patternReading" BETWEEN 1 AND 10);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_minutesMin_range" CHECK ("minutesMin" BETWEEN 15 AND 12000);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_minutesMax_range" CHECK ("minutesMax" BETWEEN 15 AND 12000);
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_minutes_order" CHECK ("minutesMin" <= "minutesMax");
ALTER TABLE "ProductDifficulty" ADD CONSTRAINT "ProductDifficulty_techniques_count" CHECK (cardinality("techniques") <= 12);
