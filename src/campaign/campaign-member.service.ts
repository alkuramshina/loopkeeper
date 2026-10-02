import { lockCampaignMember } from './access/campaign-write';
import { Prisma } from '@prisma/client';
import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
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
    return this.prisma.$transaction(async (tx) => {
      await lockCampaignMember(tx, ownerId, campaignId, [CampaignRole.OWNER]);
      await this.requireManageableMember(campaignId, userId, tx);
      return tx.campaignMember.update({
        where: { userId_campaignId: { userId, campaignId } },
        data: { campaignRole: updateDto.role },
        select: memberSelect,
      });
    });
  }

  async remove(ownerId: string, campaignId: string, userId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);
    await this.prisma.$transaction(async (tx) => {
      await lockCampaignMember(tx, ownerId, campaignId, [CampaignRole.OWNER]);
      await this.requireManageableMember(campaignId, userId, tx);
      // Personal state and views cascade with the membership row; characters remain.
      await tx.campaignMember.delete({
        where: { userId_campaignId: { userId, campaignId } },
      });
    });
  }

  // The OWNER row is never changed or removed through member management.
  private async requireManageableMember(
    campaignId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    const member = await tx.campaignMember.findUnique({
      where: { userId_campaignId: { userId, campaignId } },
      select: { campaignRole: true },
    });
    if (!member) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'member.not_found',
        'Campaign member not found',
      );
    }
    if (member.campaignRole === CampaignRole.OWNER) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'member.owner_protected',
        'The campaign owner cannot be changed or removed',
      );
    }
  }
}
