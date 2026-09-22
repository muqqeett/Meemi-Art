-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('ORDER_COMPLETED', 'PAYMENT_FAILED', 'REVIEW_SUBMITTED', 'PRODUCT_DOWNLOADED', 'WISHLIST_ACTIVITY', 'PRODUCT_ATTENTION', 'PRODUCT_CONFIGURATION');

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotificationRead" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_dedupeKey_key" ON "AdminNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminNotification_occurredAt_idx" ON "AdminNotification"("occurredAt");

-- CreateIndex
CREATE INDEX "AdminNotification_type_occurredAt_idx" ON "AdminNotification"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "AdminNotification_entityType_entityId_idx" ON "AdminNotification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminNotificationRead_userId_idx" ON "AdminNotificationRead"("userId");

-- AddForeignKey
ALTER TABLE "AdminNotificationRead" ADD CONSTRAINT "AdminNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AdminNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotificationRead" ADD CONSTRAINT "AdminNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
