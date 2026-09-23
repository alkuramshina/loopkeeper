CREATE TYPE "CharacterTemplateKind" AS ENUM ('PLAYER_CHARACTER', 'NPC');

ALTER TABLE "character_templates"
ADD COLUMN "characterKind" "CharacterTemplateKind" NOT NULL DEFAULT 'PLAYER_CHARACTER';
