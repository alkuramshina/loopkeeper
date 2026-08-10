-- CreateEnum
CREATE TYPE "CampaignRole" AS ENUM ('PLAYER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ApplicationRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "System" AS ENUM ('TALES_FROM_THE_LOOP');

-- CreateTable
CREATE TABLE "users" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "applicationRole" "ApplicationRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "system" "System",
    "description" TEXT,
    "coverUrl" TEXT,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "campaign_members" (
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignRole" "CampaignRole" NOT NULL DEFAULT 'PLAYER',

    CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "characters" (
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "campaignId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isNPC" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("characterId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "campaigns_ownerId_idx" ON "campaigns"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_members_userId_campaignId_key" ON "campaign_members"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "characters_ownerId_idx" ON "characters"("ownerId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
