import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CampaignAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireOwner(userId: string, campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { campaignId, ownerId: userId },
      select: { campaignId: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
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
      throw new NotFoundException('Campaign not found');
    }
  }
}
