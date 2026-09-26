import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { contributorRoles } from './campaign-membership';

@Injectable()
export class CampaignAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccess(userId: string, campaignId: string) {
    const campaignRole = await this.findRole(userId, campaignId);
    if (!campaignRole) {
      throw this.campaignNotFound();
    }

    return {
      isOwner: campaignRole === CampaignRole.OWNER,
      campaignRole,
    };
  }

  async requireOwner(userId: string, campaignId: string): Promise<void> {
    await this.requireRole(userId, campaignId, [CampaignRole.OWNER]);
  }

  async requireBoardContributor(
    userId: string,
    campaignId: string,
  ): Promise<void> {
    await this.requireRole(userId, campaignId, contributorRoles);
  }

  async requirePlayer(userId: string, campaignId: string): Promise<void> {
    await this.requireRole(userId, campaignId, [CampaignRole.PLAYER]);
  }

  async requireMember(userId: string, campaignId: string): Promise<void> {
    await this.getAccess(userId, campaignId);
  }

  private async requireRole(
    userId: string,
    campaignId: string,
    roles: CampaignRole[],
  ): Promise<void> {
    const campaignRole = await this.findRole(userId, campaignId);
    if (!campaignRole || !roles.includes(campaignRole)) {
      throw this.campaignNotFound();
    }
  }

  private async findRole(
    userId: string,
    campaignId: string,
  ): Promise<CampaignRole | undefined> {
    const membership = await this.prisma.campaignMember.findUnique({
      where: { userId_campaignId: { userId, campaignId } },
      select: { campaignRole: true },
    });
    return membership?.campaignRole;
  }

  private campaignNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'campaign.not_found',
      'Campaign not found',
    );
  }
}
