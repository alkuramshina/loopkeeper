ALTER TYPE "MediaAssetPurpose" ADD VALUE 'CAMPAIGN_BACKGROUND';

ALTER TABLE "media_assets" ADD COLUMN "backgroundCampaignId" TEXT;

CREATE INDEX "media_assets_backgroundCampaignId_idx" ON "media_assets"("backgroundCampaignId");

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_backgroundCampaignId_fkey" FOREIGN KEY ("backgroundCampaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;
