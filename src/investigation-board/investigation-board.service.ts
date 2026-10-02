import { EntityViewType, CampaignRole } from '@prisma/client';
import { lockCampaignMember } from '../campaign/access/campaign-write';
import {
  authorView,
  clearCardViews,
  withViewStatus,
} from '../entity-view/entity-view.helpers';
import { visibleCardWhere } from './board-access';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CampaignElementAccess,
  InvestigationCardKind,
  Prisma,
} from '@prisma/client';
import {
  DomainException,
  ErrorViolation,
} from '../common/exceptions/domain.exception';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvestigationCardDto,
  UpdateInvestigationCardDto,
} from './dto/card.dto';
import {
  CreateInvestigationLinkDto,
  UpdateInvestigationLinkDto,
} from './dto/link.dto';
import { UpdateInvestigationBoardNodeDto } from './dto/node.dto';
import { memberCampaignWhere } from '../campaign/access/campaign-membership';

const cardInclude = {
  node: true,
  createdBy: { select: { userId: true, name: true } },
  element: {
    select: {
      elementId: true,
      type: true,
      title: true,
      content: true,
      access: true,
      coverUrl: true,
    },
  },
  character: {
    select: {
      characterId: true,
      name: true,
      description: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.InvestigationCardInclude;

type CardWithReference = Prisma.InvestigationCardGetPayload<{
  include: typeof cardInclude;
}>;

@Injectable()
export class InvestigationBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
  ) {}

  async getBoard(userId: string, campaignId: string) {
    // Every member reads the board; only contributors change it.
    await this.access.requireMember(userId, campaignId);
    const board = await this.getOrCreate(campaignId);
    const result = await this.prisma.investigationBoard.findUniqueOrThrow({
      where: { boardId: board.boardId },
      include: {
        cards: {
          where: this.visibleCardWhere,
          include: cardInclude,
          orderBy: { createdAt: 'asc' },
        },
        links: { orderBy: { createdAt: 'asc' } },
      },
    });
    const cardIds = new Set(result.cards.map((card) => card.cardId));
    return {
      ...result,
      cards: await withViewStatus(
        this.prisma,
        userId,
        campaignId,
        EntityViewType.BOARD_CARD,
        result.cards.map((card) => this.presentCard(card)),
        (row) => row.cardId,
      ),
      links: await withViewStatus(
        this.prisma,
        userId,
        campaignId,
        EntityViewType.BOARD_LINK,
        result.links.filter(
          (link) => cardIds.has(link.fromCardId) && cardIds.has(link.toCardId),
        ),
        (row) => row.linkId,
      ),
    };
  }

  async createCard(
    userId: string,
    campaignId: string,
    dto: CreateInvestigationCardDto,
  ) {
    await this.access.requireBoardContributor(userId, campaignId);
    const cardKind = dto.cardKind ?? InvestigationCardKind.FREE;

    return this.prisma.$transaction(async (tx) => {
      const member = await lockCampaignMember(tx, userId, campaignId, [
        CampaignRole.OWNER,
        CampaignRole.PLAYER,
      ]);
      const board = await tx.investigationBoard.upsert({
        where: { campaignId },
        create: { campaignId },
        update: {},
      });
      // Serialize reference checks and inserts across workers on this board.
      await tx.$queryRaw`SELECT "boardId" FROM "investigation_boards" WHERE "boardId" = ${board.boardId} FOR UPDATE`;
      const source = await this.resolveCardSource(
        tx,
        campaignId,
        board.boardId,
        cardKind,
        dto,
      );
      const card = await tx.investigationCard.create({
        data: {
          cardKind,
          title: cardKind === InvestigationCardKind.FREE ? dto.title : null,
          content: cardKind === InvestigationCardKind.FREE ? dto.content : null,
          tags: dto.tags ?? [],
          color: dto.color,
          icon: dto.icon,
          elementId: source.elementId,
          characterId: source.characterId,
          campaignId,
          boardId: board.boardId,
          createdById: userId,
          node: { create: {} },
        },
        include: cardInclude,
      });
      await authorView(
        tx,
        member.memberId,
        EntityViewType.BOARD_CARD,
        card.cardId,
      );
      return { ...this.presentCard(card), isNew: false };
    });
  }

  async updateCard(
    userId: string,
    cardId: string,
    dto: UpdateInvestigationCardDto,
  ) {
    const card = await this.requireCard(userId, cardId);
    if (
      card.cardKind !== InvestigationCardKind.FREE &&
      (dto.title !== undefined || dto.content !== undefined)
    ) {
      throw this.invalidCardUpdate();
    }

    const updatedCard = await this.prisma.investigationCard.update({
      where: { cardId: card.cardId },
      data: dto,
      include: cardInclude,
    });

    return (
      await withViewStatus(
        this.prisma,
        userId,
        card.campaignId,
        EntityViewType.BOARD_CARD,
        [this.presentCard(updatedCard)],
        (row) => row.cardId,
      )
    )[0];
  }

  async deleteCard(userId: string, cardId: string) {
    const card = await this.requireCard(userId, cardId);
    await this.prisma.$transaction(async (tx) => {
      await lockCampaignMember(tx, userId, card.campaignId, [
        CampaignRole.OWNER,
        CampaignRole.PLAYER,
      ]);
      if (
        !(await tx.investigationCard.findFirst({
          where: {
            cardId,
            campaignId: card.campaignId,
            AND: [this.visibleCardWhere],
          },
        }))
      )
        throw this.cardNotFound();
      await clearCardViews(tx, { cardId, campaignId: card.campaignId });
      await tx.investigationCard.delete({ where: { cardId } });
    });
  }

  async createLink(
    userId: string,
    campaignId: string,
    dto: CreateInvestigationLinkDto,
  ) {
    await this.access.requireBoardContributor(userId, campaignId);
    if (dto.cardAId === dto.cardBId) {
      throw new DomainException(
        HttpStatus.BAD_REQUEST,
        'board.self_link',
        'A card cannot link to itself',
      );
    }
    const [fromCardId, toCardId] = [dto.cardAId, dto.cardBId].sort();
    return this.prisma.$transaction(async (tx) => {
      const member = await lockCampaignMember(tx, userId, campaignId, [
        CampaignRole.OWNER,
        CampaignRole.PLAYER,
      ]);
      const board = await tx.investigationBoard.upsert({
        where: { campaignId },
        create: { campaignId },
        update: {},
      });
      const cards = await tx.investigationCard.findMany({
        where: {
          cardId: { in: [fromCardId, toCardId] },
          boardId: board.boardId,
          AND: [this.visibleCardWhere],
        },
        select: { cardId: true },
      });
      if (cards.length !== 2) {
        throw this.cardNotFound();
      }
      const link = await tx.investigationLink.create({
        data: {
          boardId: board.boardId,
          campaignId,
          fromCardId,
          toCardId,
          label: dto.label,
          createdById: userId,
        },
      });
      await authorView(
        tx,
        member.memberId,
        EntityViewType.BOARD_LINK,
        link.linkId,
      );
      return { ...link, isNew: false };
    });
  }

  async updateLink(
    userId: string,
    linkId: string,
    dto: UpdateInvestigationLinkDto,
  ) {
    const link = await this.requireLink(userId, linkId);
    const updated = await this.prisma.investigationLink.update({
      where: { linkId: link.linkId },
      data: dto,
    });
    return (
      await withViewStatus(
        this.prisma,
        userId,
        link.campaignId,
        EntityViewType.BOARD_LINK,
        [updated],
        (row) => row.linkId,
      )
    )[0];
  }

  async deleteLink(userId: string, linkId: string) {
    const link = await this.requireLink(userId, linkId);
    await this.prisma.$transaction(async (tx) => {
      await lockCampaignMember(tx, userId, link.campaignId, [
        CampaignRole.OWNER,
        CampaignRole.PLAYER,
      ]);
      if (
        !(await tx.investigationLink.findFirst({
          where: {
            linkId,
            campaignId: link.campaignId,
            fromCard: { is: this.visibleCardWhere },
            toCard: { is: this.visibleCardWhere },
          },
        }))
      )
        throw this.linkNotFound();
      await tx.entityView.deleteMany({
        where: { entityType: EntityViewType.BOARD_LINK, entityId: linkId },
      });
      await tx.investigationLink.delete({ where: { linkId } });
    });
  }

  async updateNode(
    userId: string,
    cardId: string,
    dto: UpdateInvestigationBoardNodeDto,
  ) {
    const card = await this.requireCard(userId, cardId);
    return this.prisma.investigationBoardNode.upsert({
      where: { cardId: card.cardId },
      create: { cardId: card.cardId, ...dto },
      update: dto,
    });
  }

  private async resolveCardSource(
    tx: Prisma.TransactionClient,
    campaignId: string,
    boardId: string,
    cardKind: InvestigationCardKind,
    dto: CreateInvestigationCardDto,
  ): Promise<{ elementId?: string; characterId?: string }> {
    if (cardKind === InvestigationCardKind.FREE) {
      if (!dto.title || dto.elementId || dto.characterId) {
        throw this.invalidCardPayload();
      }
      return {};
    }

    if (cardKind === InvestigationCardKind.ELEMENT_REFERENCE) {
      if (!dto.elementId || dto.characterId || dto.title || dto.content) {
        throw this.invalidCardPayload();
      }
      // Lock the source while validating and inserting, so an access change
      // cannot commit between the check and card creation.
      const rows = await tx.$queryRaw<{ elementId: string }[]>`
        SELECT "elementId" FROM "campaign_elements"
        WHERE "elementId" = ${dto.elementId} AND "campaignId" = ${campaignId}
          AND "access" = 'SHARED' FOR SHARE`;
      if (!rows.length) throw this.cardNotFound();
      await this.assertNoReference(tx, boardId, { elementId: dto.elementId });
      return { elementId: dto.elementId };
    }

    if (
      cardKind !== InvestigationCardKind.CHARACTER_REFERENCE ||
      !dto.characterId ||
      dto.elementId ||
      dto.title ||
      dto.content
    ) {
      throw this.invalidCardPayload();
    }
    const character = await tx.character.findFirst({
      where: { characterId: dto.characterId, campaignId },
      select: { characterId: true },
    });
    if (!character) {
      throw this.cardNotFound();
    }
    await this.assertNoReference(tx, boardId, {
      characterId: character.characterId,
    });
    return { characterId: character.characterId };
  }

  private async assertNoReference(
    tx: Prisma.TransactionClient,
    boardId: string,
    source: { elementId?: string; characterId?: string },
  ): Promise<void> {
    const existing = await tx.investigationCard.findFirst({
      where: { boardId, ...source },
      select: { cardId: true },
    });
    if (existing) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'resource.conflict',
        'The resource conflicts with existing data',
      );
    }
  }

  private presentCard(card: CardWithReference) {
    const { element, character, ...cardData } = card;
    if (
      card.cardKind === InvestigationCardKind.ELEMENT_REFERENCE &&
      element?.access === CampaignElementAccess.SHARED
    ) {
      return {
        ...cardData,
        title: element.title,
        content: this.preview(element.content),
        reference: {
          kind: 'ELEMENT',
          type: element.type,
          elementId: element.elementId,
          coverUrl: element.coverUrl,
        },
      };
    }
    if (
      card.cardKind === InvestigationCardKind.CHARACTER_REFERENCE &&
      character
    ) {
      return {
        ...cardData,
        title: character.name,
        content: this.preview(character.description),
        reference: {
          kind: 'CHARACTER',
          characterId: character.characterId,
          avatarUrl: character.avatarUrl,
        },
      };
    }
    return cardData;
  }

  private readonly visibleCardWhere = visibleCardWhere;

  private preview(content?: string | null): string | null {
    if (!content) {
      return null;
    }
    return content.length > 500 ? `${content.slice(0, 497)}...` : content;
  }

  private invalidCardPayload(): DomainException {
    const violations: ErrorViolation[] = [
      { field: 'cardKind', code: 'validation.invalid_value' },
    ];
    return new DomainException(
      HttpStatus.BAD_REQUEST,
      'validation.failed',
      'Request validation failed',
      violations,
    );
  }

  private invalidCardUpdate(): DomainException {
    return new DomainException(
      HttpStatus.BAD_REQUEST,
      'validation.invalid_value',
      'Referenced card content is managed by its source',
    );
  }

  private cardNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'board.card_not_found',
      'Investigation card not found',
    );
  }

  private linkNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'board.link_not_found',
      'Investigation link not found',
    );
  }

  private async getOrCreate(campaignId: string) {
    return this.prisma.investigationBoard.upsert({
      where: { campaignId },
      create: { campaignId },
      update: {},
    });
  }

  private async requireCard(userId: string, cardId: string) {
    const card = await this.prisma.investigationCard.findFirst({
      where: {
        cardId,
        AND: [this.visibleCardWhere],
        campaign: memberCampaignWhere(userId),
      },
      select: { cardId: true, campaignId: true, cardKind: true },
    });
    if (!card) throw this.cardNotFound();
    await this.access.requireBoardContributor(userId, card.campaignId);
    return card;
  }

  private async requireLink(userId: string, linkId: string) {
    const link = await this.prisma.investigationLink.findFirst({
      where: {
        linkId,
        fromCard: { is: this.visibleCardWhere },
        toCard: { is: this.visibleCardWhere },
        campaign: memberCampaignWhere(userId),
      },
      select: { linkId: true, campaignId: true },
    });
    if (!link) throw this.linkNotFound();
    await this.access.requireBoardContributor(userId, link.campaignId);
    return link;
  }
}
