INSERT INTO "character_templates" (
  "templateId", "name", "schema", "version", "characterKind", "isActive", "systemSlug", "updatedAt"
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'NPC',
  '{"title":"Tales from the Loop — NPC","sections":[{"key":"profile","label":"Profile"}],"fields":[{"key":"role","label":"Role","section":"profile","type":"string","required":true,"maxLength":100},{"key":"motivation","label":"Motivation","section":"profile","type":"string","maxLength":500},{"key":"firstImpression","label":"First impression","section":"profile","type":"string","maxLength":500},{"key":"secret","label":"Secret","section":"profile","type":"string","maxLength":1000},{"key":"relationship","label":"Relationship","section":"profile","type":"string","maxLength":500}]}',
  1,
  'NPC',
  true,
  'TALES_FROM_THE_LOOP',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("templateId") DO UPDATE
SET "schema" = EXCLUDED."schema",
    "characterKind" = EXCLUDED."characterKind",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
