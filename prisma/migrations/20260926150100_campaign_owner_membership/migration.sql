-- The campaign owner becomes a campaign_members row with role OWNER;
-- campaigns.ownerId is removed afterwards.
LOCK TABLE "campaigns", "campaign_members" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "campaign_members" m
    JOIN "campaigns" c ON c."campaignId" = m."campaignId"
    WHERE m."userId" = c."ownerId"
  ) THEN
    RAISE EXCEPTION 'A campaign owner already has a membership row; resolve it manually. No rows were changed.';
  END IF;
END $$;

INSERT INTO "campaign_members" ("memberId", "createdAt", "updatedAt", "userId", "campaignId", "campaignRole")
SELECT gen_random_uuid()::text, c."createdAt", CURRENT_TIMESTAMP, c."ownerId", c."campaignId", 'OWNER'
FROM "campaigns" c;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "campaigns" c
    WHERE (
      SELECT count(*)
      FROM "campaign_members" m
      WHERE m."campaignId" = c."campaignId"
        AND m."campaignRole" = 'OWNER'
        AND m."userId" = c."ownerId"
    ) <> 1
  ) THEN
    RAISE EXCEPTION 'Every campaign must have exactly one OWNER member. No rows were changed.';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "campaign_members_one_owner_key" ON "campaign_members"("campaignId") WHERE ("campaignRole" = 'OWNER');

-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_ownerId_fkey";

-- DropIndex
DROP INDEX "campaigns_ownerId_idx";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "ownerId";

-- CreateTable
CREATE TABLE "campaign_participant_states" (
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_participant_states_pkey" PRIMARY KEY ("memberId")
);

-- AddForeignKey
ALTER TABLE "campaign_participant_states" ADD CONSTRAINT "campaign_participant_states_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "campaign_members"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;
