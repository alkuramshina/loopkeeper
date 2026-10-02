import {
  CampaignElementAccess,
  InvestigationCardKind,
  Prisma,
} from '@prisma/client';

export const visibleCardWhere: Prisma.InvestigationCardWhereInput = {
  OR: [
    { cardKind: InvestigationCardKind.FREE },
    {
      cardKind: InvestigationCardKind.ELEMENT_REFERENCE,
      element: { access: CampaignElementAccess.SHARED },
    },
    {
      cardKind: InvestigationCardKind.CHARACTER_REFERENCE,
      character: { is: {} },
    },
  ],
};

export const visibleLinkWhere: Prisma.InvestigationLinkWhereInput = {
  fromCard: { is: visibleCardWhere },
  toCard: { is: visibleCardWhere },
};
