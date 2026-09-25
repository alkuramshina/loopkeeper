-- Do not reinterpret player-authored/private notes as owner-owned elements.
-- Legacy NPCs have no public access flag: copy them as master-only elements.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "notes") THEN
    RAISE EXCEPTION 'Campaign elements migration stopped: legacy notes exist; review ownership and visibility before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM "campaign_locations" l JOIN "campaigns" c ON l."campaignId" = c."campaignId" WHERE l."createdById" <> c."ownerId") THEN
    RAISE EXCEPTION 'Campaign elements migration stopped: non-owner location creators require review';
  END IF;
  -- Location IDs and character IDs share the new element ID namespace.
  IF EXISTS (SELECT 1 FROM "characters" c JOIN "campaign_locations" l ON c."characterId" = l."locationId" WHERE c."isNPC") THEN
    RAISE EXCEPTION 'Campaign elements migration stopped: legacy NPC and location IDs collide';
  END IF;
END $$;

CREATE TYPE "CampaignElementType" AS ENUM ('NOTE', 'LOCATION', 'NPC', 'OTHER');
CREATE TYPE "CampaignElementAccess" AS ENUM ('MASTER_ONLY', 'SHARED');
ALTER TYPE "InvestigationCardKind" ADD VALUE 'ELEMENT_REFERENCE';

CREATE TABLE "campaign_elements" (
  "elementId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "campaignId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "type" "CampaignElementType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "access" "CampaignElementAccess" NOT NULL DEFAULT 'MASTER_ONLY',
  "typeData" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "coverAssetId" TEXT,
  "mapAssetId" TEXT,
  CONSTRAINT "campaign_elements_pkey" PRIMARY KEY ("elementId")
);

-- Keep old location rows intact until dependent clients have moved to elements.
INSERT INTO "campaign_elements" ("elementId", "createdAt", "updatedAt", "campaignId", "createdById", "type", "title", "content", "sortOrder", "imageUrl")
SELECT "locationId", "createdAt", "updatedAt", "campaignId", "createdById", 'LOCATION', "title", "description", "sortOrder", "imageUrl"
FROM "campaign_locations";

-- Preserve the full legacy sheet payload and its avatar/template identifiers for
-- recovery. Do not move the avatar asset: its unique FK still belongs to the
-- character, and elements have no avatar FK or equivalent media purpose.
-- Keep original character rows (including their board cards and links) intact.
-- The board's NPC character references remain hidden; publishing them as element
-- references would require an explicit decision about public sheet content.
INSERT INTO "campaign_elements" ("elementId", "createdAt", "updatedAt", "campaignId", "createdById", "type", "title", "content", "typeData")
SELECT c."characterId", c."createdAt", c."updatedAt", c."campaignId", c."ownerId", 'NPC', c."name", c."description",
  jsonb_build_object(
    'legacyCharacterId', c."characterId",
    'data', c."data",
    'templateId', c."templateId",
    'avatarUrl', c."avatarUrl",
    'avatarAssetId', c."avatarAssetId",
    'isActive', c."isActive"
  )
FROM "characters" c
WHERE c."isNPC";

CREATE UNIQUE INDEX "campaign_elements_coverAssetId_key" ON "campaign_elements"("coverAssetId");
CREATE UNIQUE INDEX "campaign_elements_mapAssetId_key" ON "campaign_elements"("mapAssetId");
CREATE INDEX "campaign_elements_campaignId_type_access_idx" ON "campaign_elements"("campaignId", "type", "access");
ALTER TABLE "campaign_elements" ADD CONSTRAINT "campaign_elements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_elements" ADD CONSTRAINT "campaign_elements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investigation_cards" ADD COLUMN "elementId" TEXT;
CREATE INDEX "investigation_cards_elementId_idx" ON "investigation_cards"("elementId");
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "campaign_elements"("elementId") ON DELETE CASCADE ON UPDATE CASCADE;
