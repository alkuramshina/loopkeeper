-- An accepted invitation always names who accepted it. The acceptor cannot
-- be removed out from under it, so the foreign key restricts deletion.

-- DropForeignKey
ALTER TABLE "campaign_invitations" DROP CONSTRAINT "campaign_invitations_acceptedById_fkey";

-- AddForeignKey
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Not modelled by Prisma: acceptedAt and acceptedById are set together.
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_acceptor_check" CHECK (("acceptedAt" IS NULL) = ("acceptedById" IS NULL));
