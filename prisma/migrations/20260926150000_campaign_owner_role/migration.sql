-- Separate migration: a new enum value cannot be used in the transaction
-- that adds it.
ALTER TYPE "CampaignRole" ADD VALUE 'OWNER' BEFORE 'PLAYER';
