BEGIN;

LOCK TABLE "investigation_cards" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "investigation_cards"
    WHERE "color" IS NOT NULL
      AND lower("color") NOT IN (
        '#6d1f25', '#c36b3d', '#39726a', '#436b9c', '#6e5a92'
      )
  ) THEN
    RAISE EXCEPTION 'Unknown board card color: migration stopped without changing rows.';
  END IF;
END $$;

UPDATE "investigation_cards"
SET "color" = CASE lower("color")
  WHEN '#6d1f25' THEN 'rose'
  WHEN '#c36b3d' THEN 'ochre'
  WHEN '#39726a' THEN 'olive'
  WHEN '#436b9c' THEN 'blue'
  WHEN '#6e5a92' THEN 'grey'
  ELSE "color"
END
WHERE "color" IS NOT NULL;

ALTER TABLE "investigation_cards"
ADD CONSTRAINT "investigation_cards_color_key_check"
CHECK ("color" IS NULL OR "color" IN ('ochre', 'rose', 'blue', 'olive', 'grey'));

COMMIT;
