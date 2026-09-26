-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaAssetPurpose" ADD VALUE 'ELEMENT_COVER';
ALTER TYPE "MediaAssetPurpose" ADD VALUE 'LOCATION_MAP';

-- AlterTable
ALTER TABLE "campaign_elements" ADD COLUMN     "coverUrl" TEXT;

-- AddForeignKey
ALTER TABLE "campaign_elements" ADD CONSTRAINT "campaign_elements_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "media_assets"("assetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_elements" ADD CONSTRAINT "campaign_elements_mapAssetId_fkey" FOREIGN KEY ("mapAssetId") REFERENCES "media_assets"("assetId") ON DELETE SET NULL ON UPDATE CASCADE;
