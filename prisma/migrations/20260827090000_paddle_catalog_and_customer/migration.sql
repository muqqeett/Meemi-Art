-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "paddlePriceCents" INTEGER,
ADD COLUMN     "paddlePriceId" TEXT,
ADD COLUMN     "paddleProductId" TEXT,
ADD COLUMN     "paddleSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paddleCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_paddleProductId_key" ON "Product"("paddleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_paddlePriceId_key" ON "Product"("paddlePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_paddleCustomerId_key" ON "User"("paddleCustomerId");
