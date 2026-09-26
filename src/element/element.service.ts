import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CampaignElementAccess,
  CampaignElementType,
  CampaignRole,
  Prisma,
} from '@prisma/client';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { DomainException } from '../common/exceptions/domain.exception';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateElementDto, UpdateElementDto } from './dto/element.dto';
import { editableElementWhere, readableElementWhere } from './element-access';

const npcFields: Record<string, number> = {
  role: 100,
  motivation: 500,
  firstImpression: 500,
  secret: 1000,
  relationship: 500,
};

const elementInclude = {
  createdBy: { select: { userId: true, name: true } },
} satisfies Prisma.CampaignElementInclude;

@Injectable()
export class ElementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, campaignId: string, dto: CreateElementDto) {
    const { isOwner, campaignRole } = await this.access.getAccess(
      userId,
      campaignId,
    );
    if (!isOwner && campaignRole !== CampaignRole.PLAYER) {
      throw this.campaignNotFound();
    }
    if (!isOwner && dto.type !== CampaignElementType.NOTE) {
      throw this.invalid('type');
    }
    const access =
      dto.access ??
      (isOwner
        ? CampaignElementAccess.MASTER_ONLY
        : CampaignElementAccess.PRIVATE);
    this.validateAccess(isOwner, access);
    if (!dto.title.trim()) throw this.invalid();
    this.validateTypeData(dto.type, dto.typeData, dto.imageUrl);
    return this.prisma.campaignElement.create({
      data: {
        campaignId,
        createdById: userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        access,
        typeData: (dto.typeData ?? {}) as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder,
        imageUrl: dto.imageUrl,
      },
      include: elementInclude,
    });
  }

  async findAll(
    userId: string,
    campaignId: string,
    type?: CampaignElementType,
  ) {
    const { isOwner, campaignRole } = await this.access.getAccess(
      userId,
      campaignId,
    );
    let visibility: Prisma.CampaignElementWhereInput;
    if (isOwner) {
      visibility = {
        OR: [
          { access: { not: CampaignElementAccess.PRIVATE } },
          { createdById: userId },
        ],
      };
    } else if (campaignRole === CampaignRole.PLAYER) {
      visibility = {
        OR: [{ access: CampaignElementAccess.SHARED }, { createdById: userId }],
      };
    } else {
      visibility = { access: CampaignElementAccess.SHARED };
    }
    return this.prisma.campaignElement.findMany({
      where: { campaignId, type, ...visibility },
      include: elementInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(userId: string, elementId: string) {
    const element = await this.prisma.campaignElement.findFirst({
      where: { elementId, ...readableElementWhere(userId) },
      include: elementInclude,
    });
    if (!element) throw this.notFound();
    return element;
  }

  async update(userId: string, elementId: string, dto: UpdateElementDto) {
    const element = await this.requireAuthor(userId, elementId);
    if (dto.title !== undefined && !dto.title.trim()) throw this.invalid();
    if (dto.type && dto.type !== element.type) throw this.invalid('type');
    this.validateTypeData(
      element.type,
      dto.typeData ?? (element.typeData as Record<string, unknown>),
      dto.imageUrl ?? element.imageUrl ?? undefined,
    );
    const { updated, oldStorageKey } = await this.prisma.$transaction(
      async (tx) => {
        // An explicit map URL (or null) replaces an uploaded map file.
        const current =
          dto.imageUrl !== undefined
            ? await tx.campaignElement.findUniqueOrThrow({
                where: { elementId },
                select: {
                  mapAssetId: true,
                  mapAsset: { select: { storageKey: true } },
                },
              })
            : null;
        const updated = await tx.campaignElement.update({
          where: { elementId },
          data: {
            title: dto.title,
            content: dto.content,
            sortOrder: dto.sortOrder,
            imageUrl: dto.imageUrl,
            typeData: dto.typeData as Prisma.InputJsonValue | undefined,
            ...(current?.mapAssetId ? { mapAssetId: null } : {}),
          },
          include: elementInclude,
        });
        if (current?.mapAssetId) {
          await tx.mediaAsset.delete({
            where: { assetId: current.mapAssetId },
          });
        }
        return { updated, oldStorageKey: current?.mapAsset?.storageKey };
      },
    );
    if (oldStorageKey) await this.media.removeStorageFile(oldStorageKey);
    return updated;
  }

  async setAccess(
    userId: string,
    elementId: string,
    access: CampaignElementAccess,
  ) {
    const element = await this.requireAuthor(userId, elementId);
    this.validateAccess(element.campaign.ownerId === userId, access);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "elementId" FROM "campaign_elements" WHERE "elementId" = ${elementId} FOR UPDATE`;
      // Leaving SHARED removes reference cards; their nodes and links cascade.
      if (access !== CampaignElementAccess.SHARED) {
        await tx.investigationCard.deleteMany({ where: { elementId } });
      }
      return tx.campaignElement.update({
        where: { elementId },
        data: { access },
        include: elementInclude,
      });
    });
  }

  async remove(userId: string, elementId: string) {
    await this.requireAuthor(userId, elementId);
    const storageKeys = await this.prisma.$transaction(async (tx) => {
      const element = await tx.campaignElement.delete({
        where: { elementId },
        select: {
          coverAsset: { select: { assetId: true, storageKey: true } },
          mapAsset: { select: { assetId: true, storageKey: true } },
        },
      });
      const assets = [element.coverAsset, element.mapAsset].filter(
        (asset) => asset !== null,
      );
      await tx.mediaAsset.deleteMany({
        where: { assetId: { in: assets.map((asset) => asset.assetId) } },
      });
      return assets.map((asset) => asset.storageKey);
    });
    await Promise.all(
      storageKeys.map((key) => this.media.removeStorageFile(key)),
    );
  }

  private async requireAuthor(userId: string, elementId: string) {
    const element = await this.prisma.campaignElement.findFirst({
      where: { elementId, ...editableElementWhere(userId) },
      include: { campaign: { select: { ownerId: true } } },
    });
    if (!element) throw this.notFound();
    return element;
  }

  private validateAccess(isOwner: boolean, access: CampaignElementAccess) {
    // For the owner MASTER_ONLY already means "only me"; PRIVATE is for players.
    if (isOwner && access === CampaignElementAccess.PRIVATE) {
      throw this.invalid('access');
    }
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

  private invalid(field?: string) {
    return new DomainException(
      HttpStatus.BAD_REQUEST,
      'validation.failed',
      'Request validation failed',
      field ? [{ field, code: 'validation.invalid_value' }] : undefined,
    );
  }

  private notFound() {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'Element not found',
    );
  }

  private campaignNotFound() {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'campaign.not_found',
      'Campaign not found',
    );
  }
}
