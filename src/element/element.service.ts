import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CampaignElementAccess,
  CampaignElementType,
  Prisma,
} from '@prisma/client';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateElementDto, UpdateElementDto } from './dto/element.dto';

const npcFields: Record<string, number> = {
  role: 100,
  motivation: 500,
  firstImpression: 500,
  secret: 1000,
  relationship: 500,
};

@Injectable()
export class ElementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
  ) {}

  async create(userId: string, campaignId: string, dto: CreateElementDto) {
    await this.access.requireOwner(userId, campaignId);
    if (!dto.title.trim()) throw this.invalid();
    this.validateTypeData(dto.type, dto.typeData, dto.imageUrl);
    return this.prisma.campaignElement.create({
      data: {
        campaignId,
        createdById: userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        access: dto.access ?? CampaignElementAccess.MASTER_ONLY,
        typeData: (dto.typeData ?? {}) as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async findAll(
    userId: string,
    campaignId: string,
    type?: CampaignElementType,
  ) {
    const access = await this.access.getAccess(userId, campaignId);
    return this.prisma.campaignElement.findMany({
      where: {
        campaignId,
        type,
        ...(!access.isOwner ? { access: CampaignElementAccess.SHARED } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(userId: string, elementId: string) {
    const element = await this.prisma.campaignElement.findFirst({
      where: {
        elementId,
        OR: [
          { campaign: { ownerId: userId } },
          {
            access: CampaignElementAccess.SHARED,
            campaign: { members: { some: { userId } } },
          },
        ],
      },
    });
    if (!element) throw this.notFound();
    return element;
  }

  async update(userId: string, elementId: string, dto: UpdateElementDto) {
    const element = await this.requireOwner(userId, elementId);
    if (dto.title !== undefined && !dto.title.trim()) throw this.invalid();
    this.validateTypeData(
      dto.type ?? element.type,
      dto.typeData ?? (element.typeData as Record<string, unknown>),
      dto.imageUrl ?? element.imageUrl ?? undefined,
    );
    if (dto.type && dto.type !== element.type) throw this.invalid();
    return this.prisma.$transaction(async (tx) => {
      if (dto.access !== undefined) {
        await tx.$queryRaw`SELECT "elementId" FROM "campaign_elements" WHERE "elementId" = ${elementId} FOR UPDATE`;
      }
      // Removing reference cards also cascades their nodes and links.
      if (dto.access === CampaignElementAccess.MASTER_ONLY) {
        await tx.investigationCard.deleteMany({ where: { elementId } });
      }
      return tx.campaignElement.update({
        where: { elementId },
        data: {
          title: dto.title,
          content: dto.content,
          access: dto.access,
          sortOrder: dto.sortOrder,
          imageUrl: dto.imageUrl,
          typeData: dto.typeData as Prisma.InputJsonValue | undefined,
        },
      });
    });
  }

  async setAccess(
    userId: string,
    elementId: string,
    access: CampaignElementAccess,
  ) {
    await this.requireOwner(userId, elementId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "elementId" FROM "campaign_elements" WHERE "elementId" = ${elementId} FOR UPDATE`;
      if (access === CampaignElementAccess.MASTER_ONLY) {
        await tx.investigationCard.deleteMany({ where: { elementId } });
      }
      return tx.campaignElement.update({
        where: { elementId },
        data: { access },
      });
    });
  }

  async remove(userId: string, elementId: string) {
    await this.requireOwner(userId, elementId);
    await this.prisma.campaignElement.delete({ where: { elementId } });
  }

  private async requireOwner(userId: string, elementId: string) {
    const element = await this.prisma.campaignElement.findFirst({
      where: { elementId, campaign: { ownerId: userId } },
    });
    if (!element) throw this.notFound();
    return element;
  }

  private validateTypeData(
    type: CampaignElementType,
    data?: Record<string, unknown>,
    imageUrl?: string,
  ) {
    if (imageUrl && type !== CampaignElementType.LOCATION) throw this.invalid();
    if (!data) {
      if (type === CampaignElementType.NPC) throw this.invalid();
      return;
    }
    if (type !== CampaignElementType.NPC) {
      if (Object.keys(data).length) throw this.invalid();
      return;
    }
    if (
      typeof data.role !== 'string' ||
      !data.role.trim() ||
      data.role.length > npcFields.role
    )
      throw this.invalid();
    for (const [key, value] of Object.entries(data)) {
      if (
        !(key in npcFields) ||
        typeof value !== 'string' ||
        value.length > npcFields[key]
      )
        throw this.invalid();
    }
  }

  private invalid() {
    return new DomainException(
      HttpStatus.BAD_REQUEST,
      'validation.failed',
      'Request validation failed',
    );
  }

  private notFound() {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'Element not found',
    );
  }
}
