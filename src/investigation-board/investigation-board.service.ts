import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class InvestigationBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
  ) {}

  async getBoard(userId: string, campaignId: string) {
    await this.access.requireBoardContributor(userId, campaignId);
    const board = await this.getOrCreate(campaignId);
    return this.prisma.investigationBoard.findUniqueOrThrow({
      where: { boardId: board.boardId },
      include: {
        cards: { include: { node: true }, orderBy: { createdAt: 'asc' } },
        links: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async createCard(
    userId: string,
    campaignId: string,
    dto: CreateInvestigationCardDto,
  ) {
    await this.access.requireBoardContributor(userId, campaignId);
    const board = await this.getOrCreate(campaignId);
    return this.prisma.investigationCard.create({
      data: {
        ...dto,
        tags: dto.tags ?? [],
        campaignId,
        boardId: board.boardId,
        createdById: userId,
        node: { create: {} },
      },
      include: { node: true },
    });
  }

  async updateCard(
    userId: string,
    cardId: string,
    dto: UpdateInvestigationCardDto,
  ) {
    const card = await this.requireCard(userId, cardId);
    return this.prisma.investigationCard.update({
      where: { cardId: card.cardId },
      data: dto,
      include: { node: true },
    });
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
    if (dto.cardAId === dto.cardBId)
      throw new BadRequestException('A card cannot link to itself');
    const board = await this.getOrCreate(campaignId);
    const [fromCardId, toCardId] = [dto.cardAId, dto.cardBId].sort();
    const cards = await this.prisma.investigationCard.findMany({
      where: { cardId: { in: [fromCardId, toCardId] }, boardId: board.boardId },
      select: { cardId: true },
    });
    if (cards.length !== 2)
      throw new NotFoundException('Investigation card not found');
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
      select: { cardId: true, campaignId: true },
    });
    if (!card) throw new NotFoundException('Investigation card not found');
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
    if (!link) throw new NotFoundException('Investigation link not found');
    await this.access.requireBoardContributor(userId, link.campaignId);
    return link;
  }
}
