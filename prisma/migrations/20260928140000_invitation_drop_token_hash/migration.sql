-- Invitation links are now an HMAC of the invitation id; the random-secret
-- invitations cannot produce a link, so they are removed with their hash.
-- Memberships created by accepting them are separate rows and stay.
DELETE FROM "campaign_invitations" WHERE "tokenHash" IS NOT NULL;

-- AlterTable
ALTER TABLE "campaign_invitations" DROP COLUMN "tokenHash";
