import { Injectable } from '@nestjs/common';

import { CampaignAccessService } from './access/campaign-access.service';

import { UpdateMemberDto } from './dto/update-member.dto';
import { PrismaService } from '../prisma/prisma.service';

const memberSelect = {
  memberId: true,
  campaignId: true,
  campaignRole: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      userId: true,
      email: true,
      name: true,
      avatarUrl: true,
    },
  },
} as const;

@Injectable()
export class CampaignMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async findAll(ownerId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    return this.prisma.campaignMember.findMany({
      where: { campaignId },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    ownerId: string,
    campaignId: string,
    userId: string,
    updateDto: UpdateMemberDto,
  ) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    return this.prisma.campaignMember.update({
      where: { userId_campaignId: { userId, campaignId } },
      data: { campaignRole: updateDto.role },
      select: memberSelect,
    });
  }

  async remove(ownerId: string, campaignId: string, userId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    await this.prisma.campaignMember.delete({
      where: { userId_campaignId: { userId, campaignId } },
    });
  }
}
