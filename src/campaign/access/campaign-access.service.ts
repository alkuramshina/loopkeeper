import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CampaignAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccess(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          select: { campaignRole: true },
        },
      },
    });

    if (!campaign) {
      throw this.campaignNotFound();
    }

    return {
      isOwner: campaign.ownerId === userId,
      campaignRole: campaign.members[0]?.campaignRole,
    };
  }

  async requireOwner(userId: string, campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { campaignId, ownerId: userId },
      select: { campaignId: true },
    });

    if (!campaign) {
      throw this.campaignNotFound();
    }
  }

  async requireBoardContributor(
    userId: string,
    campaignId: string,
  ): Promise<void> {
    const access = await this.getAccess(userId, campaignId);
    if (access.isOwner || access.campaignRole === CampaignRole.PLAYER) {
      return;
    }
    throw this.campaignNotFound();
  }

  async requirePlayer(userId: string, campaignId: string): Promise<void> {
    const membership = await this.prisma.campaignMember.findFirst({
      where: { campaignId, userId, campaignRole: CampaignRole.PLAYER },
      select: { memberId: true },
    });

    if (!membership) {
      throw this.campaignNotFound();
    }
  }

  async requireMember(userId: string, campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { campaignId: true },
    });

    if (!campaign) {
      throw this.campaignNotFound();
    }
  }

  private campaignNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'campaign.not_found',
      'Campaign not found',
    );
  }
}
