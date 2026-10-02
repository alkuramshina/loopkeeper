import { EntityViewType, Prisma } from '@prisma/client';

export async function withViewStatus<T extends { createdById: string }>(
  tx: Prisma.TransactionClient,
  userId: string,
  campaignId: string,
  entityType: EntityViewType,
  rows: T[],
  id: (row: T) => string,
) {
  const views = await tx.entityView.findMany({
    where: {
      member: { userId, campaignId },
      entityType,
      entityId: { in: rows.map(id) },
    },
    select: { entityId: true },
  });
  const seen = new Set(views.map((view) => view.entityId));
  return rows.map((row) => ({
    ...row,
    isNew: row.createdById !== userId && !seen.has(id(row)),
  }));
}

export async function authorView(
  tx: Prisma.TransactionClient,
  memberId: string,
  entityType: EntityViewType,
  entityId: string,
) {
  await tx.entityView.createMany({
    data: [{ memberId, entityType, entityId }],
    skipDuplicates: true,
  });
}

export async function clearCardViews(
  tx: Prisma.TransactionClient,
  where: Prisma.InvestigationCardWhereInput,
) {
  const cards = await tx.investigationCard.findMany({
    where,
    select: { cardId: true },
  });
  const ids = cards.map((card) => card.cardId);
  const links = await tx.investigationLink.findMany({
    where: { OR: [{ fromCardId: { in: ids } }, { toCardId: { in: ids } }] },
    select: { linkId: true },
  });
  await tx.entityView.deleteMany({
    where: {
      OR: [
        { entityType: EntityViewType.BOARD_CARD, entityId: { in: ids } },
        {
          entityType: EntityViewType.BOARD_LINK,
          entityId: { in: links.map((link) => link.linkId) },
        },
      ],
    },
  });
}
