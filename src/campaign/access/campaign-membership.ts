import { CampaignRole, Prisma } from '@prisma/client';

// CampaignMember is the only source of campaign membership: the master is the
// single member with role OWNER. Every campaign visibility or role check
// builds its Prisma filter here instead of repeating the condition.
type CampaignMembershipWhere = Required<
  Pick<Prisma.CampaignWhereInput, 'members'>
>;

export const memberCampaignWhere = (
  userId: string,
  roles?: CampaignRole[],
): CampaignMembershipWhere => ({
  members: {
    some: { userId, ...(roles ? { campaignRole: { in: roles } } : {}) },
  },
});

export const ownerCampaignWhere = (userId: string): CampaignMembershipWhere =>
  memberCampaignWhere(userId, [CampaignRole.OWNER]);

// Roles that may edit the board and author elements.
export const contributorRoles: CampaignRole[] = [
  CampaignRole.OWNER,
  CampaignRole.PLAYER,
];
