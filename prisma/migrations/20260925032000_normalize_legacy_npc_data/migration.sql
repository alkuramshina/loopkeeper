-- The original NPC row remains intact for legacy avatar/template recovery.
-- Expose only the public-facing NPC fields through element typeData.
UPDATE "campaign_elements" AS e
SET "typeData" = jsonb_strip_nulls(jsonb_build_object(
  'role', c."data"->>'role',
  'motivation', c."data"->>'motivation',
  'firstImpression', c."data"->>'firstImpression',
  'secret', c."data"->>'secret',
  'relationship', c."data"->>'relationship'
))
FROM "characters" AS c
WHERE e."elementId" = c."characterId"
  AND e."type" = 'NPC'
  AND c."isNPC" = true;
