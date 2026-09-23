import { HttpStatus, Injectable } from '@nestjs/common';
import { InvestigationCardKind, NoteVisibility, Prisma } from '@prisma/client';
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

const cardInclude = {
  node: true,
  note: {
    select: { noteId: true, title: true, content: true },
  },
  character: {
    select: {
      characterId: true,
      name: true,
      description: true,
      avatarUrl: true,
      isNPC: true,
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
    await this.access.requireBoardContributor(userId, campaignId);
    const board = await this.getOrCreate(campaignId);
    const result = await this.prisma.investigationBoard.findUniqueOrThrow({
      where: { boardId: board.boardId },
      include: {
        cards: { include: cardInclude, orderBy: { createdAt: 'asc' } },
        links: { orderBy: { createdAt: 'asc' } },
      },
    });

    return { ...result, cards: result.cards.map((card) => this.presentCard(card)) };
  }

  async createCard(
    userId: string,
    campaignId: string,
    dto: CreateInvestigationCardDto,
  ) {
    await this.access.requireBoardContributor(userId, campaignId);
    const board = await this.getOrCreate(campaignId);
    const cardKind = dto.cardKind ?? InvestigationCardKind.FREE;

    const source = await this.resolveCardSource(campaignId, board.boardId, cardKind, dto);
    const card = await this.prisma.investigationCard.create({
      data: {
        cardKind,
        title: cardKind === InvestigationCardKind.FREE ? dto.title : null,
        content: cardKind === InvestigationCardKind.FREE ? dto.content : null,
        tags: dto.tags ?? [],
        color: dto.color,
        icon: dto.icon,
        noteId: source.noteId,
        characterId: source.characterId,
        campaignId,
        boardId: board.boardId,
        createdById: userId,
        node: { create: {} },
      },
      include: cardInclude,
    });

    return this.presentCard(card);
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

    return this.presentCard(updatedCard);
  }

  async deleteCard(userId: string, cardId: string) {
    const card = await this.requireCard(userId, cardId);
    await this.prisma.investigationCard.delete({
      where: { cardId: card.cardId },
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
    const board = await this.getOrCreate(campaignId);
    const [fromCardId, toCardId] = [dto.cardAId, dto.cardBId].sort();
    const cards = await this.prisma.investigationCard.findMany({
      where: { cardId: { in: [fromCardId, toCardId] }, boardId: board.boardId },
      select: { cardId: true },
    });
    if (cards.length !== 2) {
      throw this.cardNotFound();
    }
    return this.prisma.investigationLink.create({
      data: {
        boardId: board.boardId,
        campaignId,
        fromCardId,
        toCardId,
        label: dto.label,
        createdById: userId,
      },
    });
  }

  async updateLink(
    userId: string,
    linkId: string,
    dto: UpdateInvestigationLinkDto,
  ) {
    const link = await this.requireLink(userId, linkId);
    return this.prisma.investigationLink.update({
      where: { linkId: link.linkId },
      data: dto,
    });
  }

  async deleteLink(userId: string, linkId: string) {
    const link = await this.requireLink(userId, linkId);
    await this.prisma.investigationLink.delete({
      where: { linkId: link.linkId },
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
    campaignId: string,
    boardId: string,
    cardKind: InvestigationCardKind,
    dto: CreateInvestigationCardDto,
  ): Promise<{ noteId?: string; characterId?: string }> {
    if (cardKind === InvestigationCardKind.FREE) {
      if (!dto.title || dto.noteId || dto.characterId) {
        throw this.invalidCardPayload();
      }
      return {};
    }

    if (cardKind === InvestigationCardKind.NOTE_REFERENCE) {
      if (!dto.noteId || dto.characterId || dto.title || dto.content) {
        throw this.invalidCardPayload();
      }
      const note = await this.prisma.note.findFirst({
        where: {
          noteId: dto.noteId,
          campaignId,
          visibility: { in: [NoteVisibility.PLAYERS, NoteVisibility.PUBLIC] },
        },
        select: { noteId: true },
      });
      if (!note) {
        throw this.cardNotFound();
      }
      await this.assertNoReference(boardId, { noteId: note.noteId });
      return { noteId: note.noteId };
    }

    if (!dto.characterId || dto.noteId || dto.title || dto.content) {
      throw this.invalidCardPayload();
    }
    const character = await this.prisma.character.findFirst({
      where: { characterId: dto.characterId, campaignId },
      select: { characterId: true },
    });
    if (!character) {
      throw this.cardNotFound();
    }
    await this.assertNoReference(boardId, { characterId: character.characterId });
    return { characterId: character.characterId };
  }

  private async assertNoReference(
    boardId: string,
    source: { noteId?: string; characterId?: string },
  ): Promise<void> {
    const existing = await this.prisma.investigationCard.findFirst({
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
    const { note, character, ...cardData } = card;
    if (card.cardKind === InvestigationCardKind.NOTE_REFERENCE && note) {
      return {
        ...cardData,
        title: note.title,
        content: this.preview(note.content),
        reference: { kind: 'NOTE', noteId: note.noteId },
      };
    }
    if (card.cardKind === InvestigationCardKind.CHARACTER_REFERENCE && character) {
      return {
        ...cardData,
        title: character.name,
        content: this.preview(character.description),
        reference: {
          kind: 'CHARACTER',
          characterId: character.characterId,
          avatarUrl: character.avatarUrl,
          isNPC: character.isNPC,
        },
      };
    }
    return cardData;
  }

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
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
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
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
      select: { linkId: true, campaignId: true },
    });
    if (!link) throw this.linkNotFound();
    await this.access.requireBoardContributor(userId, link.campaignId);
    return link;
  }
}
