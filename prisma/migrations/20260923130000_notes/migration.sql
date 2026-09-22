-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE', 'MASTER_ONLY', 'PLAYERS', 'PUBLIC');

-- CreateTable
CREATE TABLE "notes" (
    "noteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'PRIVATE',
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("noteId")
);

-- CreateIndex
CREATE INDEX "notes_campaignId_visibility_idx" ON "notes"("campaignId", "visibility");
CREATE INDEX "notes_campaignId_authorId_idx" ON "notes"("campaignId", "authorId");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("campaignId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
