-- Refuse to discard legacy-only content on any database, regardless of the local inventory.
-- Lock the source tables while checking so concurrent legacy writes cannot slip through.
LOCK TABLE "notes", "campaign_locations", "characters", "investigation_cards", "character_templates" IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "notes") OR EXISTS (
    SELECT 1 FROM "investigation_cards" WHERE "cardKind" = 'NOTE_REFERENCE' OR "noteId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Legacy removal stopped: notes or note board cards exist. Export/review them before applying this migration; no rows were deleted.';
  END IF;
  IF EXISTS (SELECT 1 FROM "characters" WHERE "isNPC") OR EXISTS (
    SELECT 1 FROM "investigation_cards" ic JOIN "characters" c ON c."characterId" = ic."characterId" WHERE c."isNPC"
  ) THEN
    RAISE EXCEPTION 'Legacy removal stopped: NPC characters (possibly with avatars or board cards/links) exist. Review and migrate them before applying this migration; no rows were deleted.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "character_templates"
    WHERE "characterKind" = 'NPC' AND "templateId" <> '00000000-0000-4000-8000-000000000002'
  ) OR EXISTS (
    SELECT 1 FROM "characters" c JOIN "character_templates" t ON t."templateId" = c."templateId"
    WHERE t."characterKind" = 'NPC'
  ) THEN
    RAISE EXCEPTION 'Legacy removal stopped: custom NPC templates exist. Review them before applying this migration; no rows were deleted.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "character_templates" WHERE "templateId" = '00000000-0000-4000-8000-000000000002'
      AND ("characterKind" <> 'NPC' OR "name" <> 'NPC' OR "version" <> 1
        OR "systemSlug" <> 'TALES_FROM_THE_LOOP' OR NOT "isActive"
        OR "schema" <> '{"title":"Tales from the Loop — NPC","sections":[{"key":"profile","label":"Profile"}],"fields":[{"key":"role","label":"Role","section":"profile","type":"string","required":true,"maxLength":100},{"key":"motivation","label":"Motivation","section":"profile","type":"string","maxLength":500},{"key":"firstImpression","label":"First impression","section":"profile","type":"string","maxLength":500},{"key":"secret","label":"Secret","section":"profile","type":"string","maxLength":1000},{"key":"relationship","label":"Relationship","section":"profile","type":"string","maxLength":500}]}'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Legacy removal stopped: the seeded NPC template was changed. Review it before applying this migration; no rows were deleted.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "campaign_locations" l
    LEFT JOIN "campaign_elements" e ON e."elementId" = l."locationId"
    WHERE e."elementId" IS NULL OR e."type" <> 'LOCATION'
      OR e."createdAt" IS DISTINCT FROM l."createdAt"
      OR e."updatedAt" IS DISTINCT FROM l."updatedAt"
      OR e."campaignId" IS DISTINCT FROM l."campaignId"
      OR e."createdById" IS DISTINCT FROM l."createdById"
      OR e."title" IS DISTINCT FROM l."title"
      OR e."content" IS DISTINCT FROM l."description"
      OR e."imageUrl" IS DISTINCT FROM l."imageUrl"
      OR e."sortOrder" IS DISTINCT FROM l."sortOrder"
  ) THEN
    RAISE EXCEPTION 'Legacy removal stopped: a location is missing from elements or differs from its copied fields. Review later edits before dropping legacy locations; no rows were deleted.';
  END IF;
END $$;

ALTER TABLE "investigation_cards" DROP CONSTRAINT "investigation_cards_reference_shape_check";
ALTER TABLE "investigation_cards" DROP CONSTRAINT "investigation_cards_noteId_fkey";
DROP INDEX "investigation_cards_boardId_noteId_key";
DROP INDEX "investigation_cards_noteId_idx";
ALTER TABLE "investigation_cards" DROP COLUMN "noteId";

-- PostgreSQL enums cannot drop individual values; replace the type after guards pass.
ALTER TYPE "InvestigationCardKind" RENAME TO "InvestigationCardKind_legacy";
CREATE TYPE "InvestigationCardKind" AS ENUM ('FREE', 'CHARACTER_REFERENCE', 'ELEMENT_REFERENCE');
ALTER TABLE "investigation_cards" ALTER COLUMN "cardKind" DROP DEFAULT;
ALTER TABLE "investigation_cards" ALTER COLUMN "cardKind" TYPE "InvestigationCardKind" USING "cardKind"::text::"InvestigationCardKind";
ALTER TABLE "investigation_cards" ALTER COLUMN "cardKind" SET DEFAULT 'FREE';
DROP TYPE "InvestigationCardKind_legacy";
ALTER TABLE "investigation_cards" ADD CONSTRAINT "investigation_cards_reference_shape_check"
  CHECK (
    ("cardKind" = 'FREE' AND "title" IS NOT NULL AND "elementId" IS NULL AND "characterId" IS NULL)
    OR ("cardKind" = 'ELEMENT_REFERENCE' AND "title" IS NULL AND "elementId" IS NOT NULL AND "characterId" IS NULL)
    OR ("cardKind" = 'CHARACTER_REFERENCE' AND "title" IS NULL AND "elementId" IS NULL AND "characterId" IS NOT NULL)
  );

DROP TABLE "notes";
DROP TYPE "NoteVisibility";
DROP TABLE "campaign_locations";

DELETE FROM "character_templates" WHERE "characterKind" = 'NPC';
ALTER TABLE "character_templates" DROP COLUMN "characterKind";
DROP TYPE "CharacterTemplateKind";
DROP INDEX "characters_active_player_per_campaign_owner_key";
ALTER TABLE "characters" DROP COLUMN "isNPC";
CREATE UNIQUE INDEX "characters_active_player_per_campaign_owner_key"
  ON "characters"("campaignId", "ownerId") WHERE "isActive" = true;
