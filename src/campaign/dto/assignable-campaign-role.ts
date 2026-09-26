import { CampaignRole } from '@prisma/client';

// Roles that invitations and member management may grant. OWNER is created
// only together with the campaign and cannot be granted, changed or removed.
export const assignableCampaignRoles = [
  CampaignRole.PLAYER,
  CampaignRole.VIEWER,
] as const;

export type AssignableCampaignRole = (typeof assignableCampaignRoles)[number];
