-- AlterTable
ALTER TABLE "campaign_invitations" ADD COLUMN     "acceptedById" TEXT;

-- AddForeignKey
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
