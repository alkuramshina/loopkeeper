ALTER TABLE "investigation_cards"
  DROP CONSTRAINT "investigation_cards_reference_shape_check";

ALTER TABLE "investigation_cards"
  ADD CONSTRAINT "investigation_cards_reference_shape_check"
    CHECK (
      ("cardKind" = 'FREE' AND "title" IS NOT NULL AND "noteId" IS NULL AND "elementId" IS NULL AND "characterId" IS NULL)
      OR ("cardKind" = 'NOTE_REFERENCE' AND "title" IS NULL AND "noteId" IS NOT NULL AND "elementId" IS NULL AND "characterId" IS NULL)
      OR ("cardKind" = 'ELEMENT_REFERENCE' AND "title" IS NULL AND "noteId" IS NULL AND "elementId" IS NOT NULL AND "characterId" IS NULL)
      OR ("cardKind" = 'CHARACTER_REFERENCE' AND "title" IS NULL AND "noteId" IS NULL AND "elementId" IS NULL AND "characterId" IS NOT NULL)
    );

CREATE UNIQUE INDEX "investigation_cards_boardId_elementId_key"
  ON "investigation_cards"("boardId", "elementId")
  WHERE "elementId" IS NOT NULL;
