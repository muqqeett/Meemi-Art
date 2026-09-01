-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActivity_createdAt_idx" ON "AdminActivity"("createdAt");

-- CreateIndex
CREATE INDEX "AdminActivity_entityType_entityId_idx" ON "AdminActivity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminActivity_actorId_createdAt_idx" ON "AdminActivity"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminActivity" ADD CONSTRAINT "AdminActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
