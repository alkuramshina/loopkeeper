-- CreateEnum
CREATE TYPE "MediaAssetContentType" AS ENUM ('IMAGE_WEBP');

-- CreateEnum
CREATE TYPE "MediaAssetPurpose" AS ENUM ('AVATAR');

-- CreateTable
CREATE TABLE "media_assets" (
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" "MediaAssetContentType" NOT NULL DEFAULT 'IMAGE_WEBP',
    "purpose" "MediaAssetPurpose" NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("assetId")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatarAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_purpose_idx" ON "media_assets"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatarAssetId_key" ON "users"("avatarAssetId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "media_assets"("assetId") ON DELETE SET NULL ON UPDATE CASCADE;
