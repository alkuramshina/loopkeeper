-- CreateEnum
CREATE TYPE "CampaignBackgroundSelectionMode" AS ENUM ('FIXED', 'RANDOM');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "backgroundSelectionMode" "CampaignBackgroundSelectionMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "backgrounds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "fixedBackgroundId" TEXT;

-- CreateTable
CREATE TABLE "campaign_locations" (
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "campaign_locations_pkey" PRIMARY KEY ("locationId")
);

-- CreateIndex
CREATE INDEX "campaign_locations_campaignId_sortOrder_idx" ON "campaign_locations"("campaignId", "sortOrder");

-- AddForeignKey
ALTER TABLE "campaign_locations" ADD CONSTRAINT "campaign_locations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_locations" ADD CONSTRAINT "campaign_locations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
