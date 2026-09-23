import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole, Prisma } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignAccessService } from './access/campaign-access.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

type CurrentUserRole = 'OWNER' | CampaignRole;

const campaignForCurrentUser = (userId: string) => ({
  campaignId: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  system: true,
  description: true,
  coverUrl: true,
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
  ) {}

  async create(userId: string, createDto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        system: 'TALES_FROM_THE_LOOP',
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

    const campaign = await this.prisma.campaign.update({
      where: { campaignId },
      data: updateDto,
      select: campaignForCurrentUser(userId),
    });

    return this.presentCampaign(campaign, userId);
  }

  async remove(userId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    await this.prisma.campaign.delete({ where: { campaignId } });
  }

  private presentCampaign(
    campaign: Prisma.CampaignGetPayload<{ select: ReturnType<typeof campaignForCurrentUser> }>,
    userId: string,
  ) {
    const { members, ownerId, ...campaignData } = campaign;
    const currentUserRole: CurrentUserRole =
      ownerId === userId ? 'OWNER' : members[0]!.campaignRole;

    return { ...campaignData, currentUserRole };
  }
}
