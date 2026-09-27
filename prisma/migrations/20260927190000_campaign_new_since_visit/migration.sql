ALTER TABLE "campaign_elements" ADD COLUMN "sharedAt" TIMESTAMP(3);

UPDATE "campaign_elements"
SET "sharedAt" = "updatedAt"
WHERE "access" = 'SHARED';

ALTER TABLE "campaign_participant_states"
  ADD COLUMN "lastVisitAt" TIMESTAMP(3),
  ADD COLUMN "newSinceAt" TIMESTAMP(3);

CREATE INDEX "campaign_elements_campaignId_access_sharedAt_idx"
  ON "campaign_elements"("campaignId", "access", "sharedAt");
