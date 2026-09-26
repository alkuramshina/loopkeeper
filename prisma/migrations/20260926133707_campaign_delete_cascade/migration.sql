-- DropForeignKey
ALTER TABLE "campaign_members" DROP CONSTRAINT "campaign_members_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "characters" DROP CONSTRAINT "characters_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "investigation_boards" DROP CONSTRAINT "investigation_boards_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "investigation_cards" DROP CONSTRAINT "investigation_cards_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "investigation_links" DROP CONSTRAINT "investigation_links_campaignId_fkey";

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_boards" ADD CONSTRAINT "investigation_boards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;
