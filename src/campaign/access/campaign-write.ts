import { HttpStatus } from '@nestjs/common';
import { CampaignRole, Prisma } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';

// All view writes and source lifecycle mutations lock the campaign first.
export async function lockCampaignMember(
  tx: Prisma.TransactionClient,
  userId: string,
  campaignId: string,
  roles?: CampaignRole[],
) {
  const rows = await tx.$queryRaw<{ campaignId: string }[]>`
    SELECT "campaignId" FROM "campaigns" WHERE "campaignId" = ${campaignId} FOR UPDATE`;
  const member = rows.length
    ? await tx.campaignMember.findUnique({
        where: { userId_campaignId: { userId, campaignId } },
      })
    : null;
  if (!member || (roles && !roles.includes(member.campaignRole))) {
    throw new DomainException(
      HttpStatus.NOT_FOUND,
      'campaign.not_found',
      'Campaign not found',
    );
  }
  return member;
}
