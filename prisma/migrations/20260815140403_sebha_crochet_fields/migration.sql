-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processingTime" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;
