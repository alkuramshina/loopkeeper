import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole, Prisma } from '@prisma/client';
import { CampaignBackgroundDto } from './dto/campaign-background-settings.dto';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CampaignAccessService } from './access/campaign-access.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

type CurrentUserRole = 'OWNER' | CampaignRole;

const campaignForCurrentUser = (userId: string) =>
  ({
    campaignId: true,
    createdAt: true,
    updatedAt: true,
    title: true,
    system: true,
    description: true,
    coverUrl: true,
    backgroundSelectionMode: true,
    fixedBackgroundId: true,
    backgrounds: true,
    ownerId: true,
    members: {
      where: { userId },
      select: { campaignRole: true },
    },
  }) satisfies Prisma.CampaignSelect;

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
    private readonly mediaService: MediaService,
  ) {}

  async create(userId: string, createDto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        system: createDto.system,
        coverUrl: createDto.coverUrl,
        ownerId: userId,
      },
      select: campaignForCurrentUser(userId),
    });

    return this.presentCampaign(campaign, userId);
  }

  async findAll(userId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { updatedAt: 'desc' },
      select: campaignForCurrentUser(userId),
    });

    return campaigns.map((campaign) => this.presentCampaign(campaign, userId));
  }

  async findOne(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: campaignForCurrentUser(userId),
    });

    if (!campaign) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'campaign.not_found',
        'The requested campaign is unavailable',
      );
    }

    return this.presentCampaign(campaign, userId);
  }

  async update(
    userId: string,
    campaignId: string,
    updateDto: UpdateCampaignDto,
  ) {
    await this.campaignAccess.requireOwner(userId, campaignId);

    const { campaign, oldStorageKey } = await this.prisma.$transaction(
      async (tx) => {
        const current =
          updateDto.coverUrl !== undefined
            ? await tx.campaign.findUniqueOrThrow({
                where: { campaignId },
                select: {
                  coverAssetId: true,
                  coverAsset: { select: { storageKey: true } },
                },
              })
            : null;
        const campaign = await tx.campaign.update({
          where: { campaignId },
          data: {
            ...updateDto,
            ...(current ? { coverAssetId: null } : {}),
          },
          select: campaignForCurrentUser(userId),
        });
        if (current?.coverAssetId) {
          await tx.mediaAsset.delete({
            where: { assetId: current.coverAssetId },
          });
        }
        return { campaign, oldStorageKey: current?.coverAsset?.storageKey };
      },
    );
    if (oldStorageKey) {
      await this.mediaService.removeStorageFile(oldStorageKey);
    }
    return this.presentCampaign(campaign, userId);
  }

  async remove(userId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    const storageKeys = await this.prisma.$transaction(async (tx) => {
      const assets = await tx.mediaAsset.findMany({
        where: {
          OR: [
            { backgroundCampaignId: campaignId },
            { campaignCover: { campaignId } },
            { elementCover: { campaignId } },
            { elementMap: { campaignId } },
          ],
        },
        select: { assetId: true, storageKey: true },
      });
      await tx.campaign.delete({ where: { campaignId } });
      // Cover and element assets are only detached by the cascade.
      await tx.mediaAsset.deleteMany({
        where: { assetId: { in: assets.map((asset) => asset.assetId) } },
      });
      return assets.map((asset) => asset.storageKey);
    });
    await Promise.all(
      storageKeys.map((key) => this.mediaService.removeStorageFile(key)),
    );
  }

  private presentCampaign(
    campaign: Prisma.CampaignGetPayload<{
      select: ReturnType<typeof campaignForCurrentUser>;
    }>,
    userId: string,
  ) {
    const {
      members,
      ownerId,
      backgroundSelectionMode,
      fixedBackgroundId,
      backgrounds,
      ...campaignData
    } = campaign;
    const currentUserRole: CurrentUserRole =
      ownerId === userId ? 'OWNER' : members[0]!.campaignRole;

    return {
      ...campaignData,
      currentUserRole,
      backgroundConfig: {
        selectionMode: backgroundSelectionMode,
        fixedBackgroundId,
        backgrounds: (backgrounds as unknown as CampaignBackgroundDto[]).filter(
          (background) => background.isEnabled,
        ),
      },
    };
  }
}
