CREATE TYPE "InvestigationCardKind" AS ENUM ('FREE', 'NOTE_REFERENCE', 'CHARACTER_REFERENCE');

ALTER TABLE "investigation_cards"
  ADD COLUMN "cardKind" "InvestigationCardKind" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "noteId" TEXT,
  ADD COLUMN "characterId" TEXT,
  ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "investigation_cards"
  ADD CONSTRAINT "investigation_cards_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "notes"("noteId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "investigation_cards_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "characters"("characterId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "investigation_cards_reference_shape_check"
    CHECK (
      ("cardKind" = 'FREE' AND "title" IS NOT NULL AND "noteId" IS NULL AND "characterId" IS NULL)
      OR ("cardKind" = 'NOTE_REFERENCE' AND "title" IS NULL AND "noteId" IS NOT NULL AND "characterId" IS NULL)
      OR ("cardKind" = 'CHARACTER_REFERENCE' AND "title" IS NULL AND "noteId" IS NULL AND "characterId" IS NOT NULL)
    );

CREATE INDEX "investigation_cards_noteId_idx" ON "investigation_cards"("noteId");
CREATE INDEX "investigation_cards_characterId_idx" ON "investigation_cards"("characterId");
CREATE UNIQUE INDEX "investigation_cards_boardId_noteId_key"
  ON "investigation_cards"("boardId", "noteId")
  WHERE "noteId" IS NOT NULL;
CREATE UNIQUE INDEX "investigation_cards_boardId_characterId_key"
  ON "investigation_cards"("boardId", "characterId")
  WHERE "characterId" IS NOT NULL;
