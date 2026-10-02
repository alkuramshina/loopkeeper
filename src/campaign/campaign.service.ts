import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole, Prisma } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CampaignAccessService } from './access/campaign-access.service';
import { memberCampaignWhere } from './access/campaign-membership';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { readableElementWhere } from '../element/element-access';
import { lockCampaignMember } from './access/campaign-write';
import { EntityViewType } from '@prisma/client';

const campaignForCurrentUser = (userId: string) =>
  ({
    campaignId: true,
    createdAt: true,
    updatedAt: true,
    title: true,
    system: true,
    description: true,
    coverUrl: true,
    members: {
      where: { userId },
      select: {
        campaignRole: true,
        memberId: true,
        participantState: { select: { lastVisitAt: true } },
      },
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
        members: {
          create: { userId, campaignRole: CampaignRole.OWNER },
        },
      },
      select: campaignForCurrentUser(userId),
    });

    return this.presentCampaign(campaign, 0);
  }

  async findAll(userId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: memberCampaignWhere(userId),
      orderBy: { updatedAt: 'desc' },
      select: campaignForCurrentUser(userId),
    });

    return Promise.all(
      campaigns.map(async (campaign) =>
        this.presentCampaign(
          campaign,
          await this.countNewMaterials(userId, campaign),
        ),
      ),
    );
  }

  async findOne(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { campaignId, ...memberCampaignWhere(userId) },
      select: campaignForCurrentUser(userId),
    });

    if (!campaign) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'campaign.not_found',
        'The requested campaign is unavailable',
      );
    }

    return this.presentCampaign(
      campaign,
      await this.countNewMaterials(userId, campaign),
    );
  }

  async visit(userId: string, campaignId: string) {
    await this.campaignAccess.requireMember(userId, campaignId);
    return this.prisma.$transaction(async (tx) => {
      const members = await tx.$queryRaw<{ memberId: string }[]>`
        SELECT "memberId" FROM "campaign_members"
        WHERE "userId" = ${userId} AND "campaignId" = ${campaignId}
        FOR UPDATE`;
      const member = members[0];
      if (!member) {
        throw new DomainException(
          HttpStatus.NOT_FOUND,
          'campaign.not_found',
          'Campaign not found',
        );
      }
      const now = new Date();
      await tx.campaignParticipantState.upsert({
        where: { memberId: member.memberId },
        create: { memberId: member.memberId, lastVisitAt: now },
        update: { lastVisitAt: now },
      });
      return { lastVisitAt: now };
    });
  }

  async update(
    userId: string,
    campaignId: string,
    updateDto: UpdateCampaignDto,
  ) {
    await this.campaignAccess.requireOwner(userId, campaignId);

    const { campaign, oldStorageKey } = await this.prisma.$transaction(
      async (tx) => {
        await lockCampaignMember(tx, userId, campaignId, [CampaignRole.OWNER]);
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
      await this.mediaService.cleanupObject(oldStorageKey);
    }
    return this.presentCampaign(
      campaign,
      await this.countNewMaterials(userId, campaign),
    );
  }

  async remove(userId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    const storageKeys = await this.prisma.$transaction(async (tx) => {
      await lockCampaignMember(tx, userId, campaignId, [CampaignRole.OWNER]);
      const assets = await tx.mediaAsset.findMany({
        where: {
          OR: [
            { campaignCover: { campaignId } },
            { characterAvatar: { campaignId } },
            { elementCover: { campaignId } },
            { elementMap: { campaignId } },
          ],
        },
        select: { assetId: true, storageKey: true },
      });
      // Members, invitations, characters, elements and the board cascade.
      await tx.campaign.delete({ where: { campaignId } });
      // Cover, avatar and element assets are only detached by the cascade.
      await tx.mediaAsset.deleteMany({
        where: { assetId: { in: assets.map((asset) => asset.assetId) } },
      });
      return assets.map((asset) => asset.storageKey);
    });
    await Promise.all(
      storageKeys.map((key) => this.mediaService.cleanupObject(key)),
    );
  }

  private presentCampaign(
    campaign: Prisma.CampaignGetPayload<{
      select: ReturnType<typeof campaignForCurrentUser>;
    }>,
    newVisibleMaterialCount: number,
  ) {
    const { members, ...campaignData } = campaign;
    return {
      ...campaignData,
      currentUserRole: members[0].campaignRole,
      lastVisitAt: members[0].participantState?.lastVisitAt ?? null,
      newVisibleMaterialCount,
    };
  }

  private countNewMaterials(
    userId: string,
    campaign: Prisma.CampaignGetPayload<{
      select: ReturnType<typeof campaignForCurrentUser>;
    }>,
  ) {
    const member = campaign.members[0];
    const views = this.prisma.entityView.findMany({
      where: { memberId: member.memberId, entityType: EntityViewType.ELEMENT },
      select: { entityId: true },
    });
    return views.then((seen) =>
      this.prisma.campaignElement.count({
        where: {
          campaignId: campaign.campaignId,
          ...readableElementWhere(userId),
          createdById: { not: userId },
          elementId: { notIn: seen.map((view) => view.entityId) },
        },
      }),
    );
  }
}
