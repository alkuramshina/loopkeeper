-- AlterEnum
ALTER TYPE "MediaAssetPurpose" ADD VALUE 'CHARACTER_AVATAR';
ALTER TYPE "MediaAssetPurpose" ADD VALUE 'CAMPAIGN_COVER';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "coverAssetId" TEXT;
ALTER TABLE "characters" ADD COLUMN "avatarAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_coverAssetId_key" ON "campaigns"("coverAssetId");
CREATE UNIQUE INDEX "characters_avatarAssetId_key" ON "characters"("avatarAssetId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "media_assets"("assetId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "characters" ADD CONSTRAINT "characters_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "media_assets"("assetId") ON DELETE SET NULL ON UPDATE CASCADE;
