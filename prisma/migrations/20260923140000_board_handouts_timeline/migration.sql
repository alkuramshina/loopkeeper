-- Shared investigation board for a campaign.
CREATE TABLE "investigation_boards" (
 "boardId" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "campaignId" TEXT NOT NULL UNIQUE
);
CREATE TABLE "investigation_cards" (
 "cardId" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "title" TEXT NOT NULL, "content" TEXT, "tags" TEXT[] NOT NULL, "color" TEXT, "icon" TEXT, "boardId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "createdById" TEXT NOT NULL
);
CREATE TABLE "investigation_links" (
 "linkId" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "label" TEXT, "boardId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "fromCardId" TEXT NOT NULL, "toCardId" TEXT NOT NULL, "createdById" TEXT NOT NULL
);
CREATE TABLE "investigation_board_nodes" (
 "nodeId" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "x" DOUBLE PRECISION NOT NULL DEFAULT 0, "y" DOUBLE PRECISION NOT NULL DEFAULT 0, "width" DOUBLE PRECISION NOT NULL DEFAULT 240, "height" DOUBLE PRECISION NOT NULL DEFAULT 160, "cardId" TEXT NOT NULL UNIQUE
);
CREATE INDEX "investigation_cards_campaignId_idx" ON "investigation_cards"("campaignId");
CREATE UNIQUE INDEX "investigation_links_campaignId_fromCardId_toCardId_key" ON "investigation_links"("campaignId", "fromCardId", "toCardId");
ALTER TABLE "investigation_boards" ADD CONSTRAINT "investigation_boards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "investigation_boards"("boardId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "investigation_boards"("boardId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_fromCardId_fkey" FOREIGN KEY ("fromCardId") REFERENCES "investigation_cards"("cardId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_toCardId_fkey" FOREIGN KEY ("toCardId") REFERENCES "investigation_cards"("cardId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investigation_links" ADD CONSTRAINT "investigation_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_board_nodes" ADD CONSTRAINT "investigation_board_nodes_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "investigation_cards"("cardId") ON DELETE CASCADE ON UPDATE CASCADE;
