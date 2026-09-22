-- CreateTable
CREATE TABLE "game_systems" (
    "slug" "System" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_systems_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "character_templates" (
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "systemSlug" "System" NOT NULL,

    CONSTRAINT "character_templates_pkey" PRIMARY KEY ("templateId")
);

-- Seed the first supported system and its active character template.
INSERT INTO "game_systems" ("slug", "name", "description", "updatedAt")
VALUES (
    'TALES_FROM_THE_LOOP',
    'Tales from the Loop',
    'The first supported game system for Loopkeeper.',
    CURRENT_TIMESTAMP
);

INSERT INTO "character_templates" ("templateId", "name", "schema", "version", "isActive", "systemSlug", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Kid',
    '{"fields":[{"key":"age","label":"Age","type":"number","required":true,"min":10,"max":19},{"key":"body","label":"Body","type":"number","required":true,"min":1,"max":5},{"key":"tech","label":"Tech","type":"number","required":true,"min":1,"max":5},{"key":"heart","label":"Heart","type":"number","required":true,"min":1,"max":5},{"key":"mind","label":"Mind","type":"number","required":true,"min":1,"max":5},{"key":"iconicItem","label":"Iconic item","type":"string","required":true,"maxLength":100},{"key":"pride","label":"Pride","type":"string","required":true,"maxLength":500}]}',
    1,
    true,
    'TALES_FROM_THE_LOOP',
    CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "characters" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "characters" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "characters" ADD COLUMN "templateId" TEXT;

-- Existing characters use the initial Tales from the Loop template.
UPDATE "characters"
SET "templateId" = '00000000-0000-4000-8000-000000000001'
WHERE "templateId" IS NULL;

ALTER TABLE "characters" ALTER COLUMN "templateId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "character_templates_systemSlug_name_version_key" ON "character_templates"("systemSlug", "name", "version");
CREATE INDEX "character_templates_systemSlug_isActive_idx" ON "character_templates"("systemSlug", "isActive");
CREATE INDEX "characters_campaignId_idx" ON "characters"("campaignId");
CREATE UNIQUE INDEX "characters_active_player_per_campaign_owner_key"
ON "characters"("campaignId", "ownerId")
WHERE "isNPC" = false AND "isActive" = true;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_system_fkey" FOREIGN KEY ("system") REFERENCES "game_systems"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_templates" ADD CONSTRAINT "character_templates_systemSlug_fkey" FOREIGN KEY ("systemSlug") REFERENCES "game_systems"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "characters" ADD CONSTRAINT "characters_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "character_templates"("templateId") ON DELETE RESTRICT ON UPDATE CASCADE;
