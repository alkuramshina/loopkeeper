-- AlterEnum
BEGIN;
CREATE TYPE "MediaAssetPurpose_new" AS ENUM ('AVATAR', 'CHARACTER_AVATAR', 'CAMPAIGN_COVER', 'ELEMENT_COVER', 'LOCATION_MAP');
ALTER TABLE "media_assets" ALTER COLUMN "purpose" TYPE "MediaAssetPurpose_new" USING ("purpose"::text::"MediaAssetPurpose_new");
ALTER TYPE "MediaAssetPurpose" RENAME TO "MediaAssetPurpose_old";
ALTER TYPE "MediaAssetPurpose_new" RENAME TO "MediaAssetPurpose";
DROP TYPE "public"."MediaAssetPurpose_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_backgroundCampaignId_fkey";

-- DropIndex
DROP INDEX "media_assets_backgroundCampaignId_idx";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "backgroundSelectionMode",
DROP COLUMN "backgrounds",
DROP COLUMN "fixedBackgroundId";

-- AlterTable
ALTER TABLE "media_assets" DROP COLUMN "backgroundCampaignId";

-- DropEnum
DROP TYPE "CampaignBackgroundSelectionMode";

