-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "CustomerProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "imageUrl" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "caption" TEXT,
    "displayName" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProject_imageKey_key" ON "CustomerProject"("imageKey");

-- CreateIndex
CREATE INDEX "CustomerProject_productId_status_createdAt_idx" ON "CustomerProject"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerProject_userId_createdAt_idx" ON "CustomerProject"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerProject_status_createdAt_idx" ON "CustomerProject"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerProject" ADD CONSTRAINT "CustomerProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProject" ADD CONSTRAINT "CustomerProject_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProject" ADD CONSTRAINT "CustomerProject_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
