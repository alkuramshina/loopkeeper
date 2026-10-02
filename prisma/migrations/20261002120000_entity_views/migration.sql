BEGIN;

-- Exclude API writes while backfilling the existing visibility matrix.
LOCK TABLE "campaigns", "campaign_members", "campaign_participant_states", "campaign_elements", "investigation_cards", "investigation_links" IN ACCESS EXCLUSIVE MODE;

CREATE TYPE "EntityViewType" AS ENUM ('ELEMENT', 'BOARD_CARD', 'BOARD_LINK');
CREATE TABLE "entity_views" (
  "memberId" TEXT NOT NULL,
  "entityType" "EntityViewType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entity_views_pkey" PRIMARY KEY ("memberId", "entityType", "entityId"),
  CONSTRAINT "entity_views_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "campaign_members"("memberId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "entity_views_entityType_entityId_idx" ON "entity_views"("entityType", "entityId");

INSERT INTO "entity_views" ("memberId", "entityType", "entityId")
SELECT m."memberId", 'ELEMENT', e."elementId"
FROM "campaign_members" m JOIN "campaign_elements" e ON e."campaignId" = m."campaignId"
WHERE e."access" = 'SHARED'
  OR (m."campaignRole" = 'OWNER' AND e."access" = 'MASTER_ONLY')
  OR (m."campaignRole" IN ('OWNER', 'PLAYER') AND e."createdById" = m."userId");

INSERT INTO "entity_views" ("memberId", "entityType", "entityId")
SELECT m."memberId", 'BOARD_CARD', c."cardId"
FROM "campaign_members" m JOIN "investigation_cards" c ON c."campaignId" = m."campaignId"
WHERE c."cardKind" = 'FREE'
 OR (c."cardKind" = 'ELEMENT_REFERENCE' AND EXISTS (SELECT 1 FROM "campaign_elements" e WHERE e."elementId" = c."elementId" AND e."access" = 'SHARED'))
 OR (c."cardKind" = 'CHARACTER_REFERENCE' AND EXISTS (SELECT 1 FROM "characters" ch WHERE ch."characterId" = c."characterId"));

INSERT INTO "entity_views" ("memberId", "entityType", "entityId")
SELECT m."memberId", 'BOARD_LINK', l."linkId"
FROM "campaign_members" m JOIN "investigation_links" l ON l."campaignId" = m."campaignId"
WHERE EXISTS (SELECT 1 FROM "entity_views" v WHERE v."memberId" = m."memberId" AND v."entityType" = 'BOARD_CARD' AND v."entityId" = l."fromCardId")
  AND EXISTS (SELECT 1 FROM "entity_views" v WHERE v."memberId" = m."memberId" AND v."entityType" = 'BOARD_CARD' AND v."entityId" = l."toCardId");

-- Verify every visible element pair before removing the superseded visit window.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "campaign_members" m JOIN "campaign_elements" e ON e."campaignId" = m."campaignId"
    WHERE (e."access" = 'SHARED' OR (m."campaignRole" = 'OWNER' AND e."access" = 'MASTER_ONLY') OR (m."campaignRole" IN ('OWNER', 'PLAYER') AND e."createdById" = m."userId"))
    AND NOT EXISTS (SELECT 1 FROM "entity_views" v WHERE v."memberId" = m."memberId" AND v."entityType" = 'ELEMENT' AND v."entityId" = e."elementId")
  ) THEN RAISE EXCEPTION 'Incomplete view backfill; no rows were deleted.';
  END IF;
END $$;
ALTER TABLE "campaign_participant_states" DROP COLUMN "newSinceAt";
COMMIT;
