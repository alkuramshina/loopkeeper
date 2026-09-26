import { CampaignElementAccess, Prisma } from '@prisma/client';
import {
  contributorRoles,
  memberCampaignWhere,
  ownerCampaignWhere,
} from '../campaign/access/campaign-membership';

// Authors keep rights on their elements only while they remain the campaign
// owner or a PLAYER member.
export const authorCampaignWhere = (
  userId: string,
): Prisma.CampaignWhereInput => memberCampaignWhere(userId, contributorRoles);

// Elements the user may read right now. Element media delivery reuses this
// rule so that images follow the current access of their element.
export const readableElementWhere = (
  userId: string,
): Prisma.CampaignElementWhereInput => ({
  OR: [
    {
      access: CampaignElementAccess.SHARED,
      campaign: memberCampaignWhere(userId),
    },
    {
      access: CampaignElementAccess.MASTER_ONLY,
      campaign: ownerCampaignWhere(userId),
    },
    { createdById: userId, campaign: authorCampaignWhere(userId) },
  ],
});

// Elements the user may edit: own elements while still owner or PLAYER.
export const editableElementWhere = (
  userId: string,
): Prisma.CampaignElementWhereInput => ({
  createdById: userId,
  campaign: authorCampaignWhere(userId),
});
