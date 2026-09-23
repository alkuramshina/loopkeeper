import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { CampaignAccessService } from './access/campaign-access.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';

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
    private readonly users: UserService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async create(
    ownerId: string,
    campaignId: string,
    createDto: CreateMemberDto,
  ) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const user = await this.users.findByEmail(createDto.email);
    if (!user || user.userId === ownerId) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'resource.not_found',
        'The requested user is unavailable',
      );
    }

    return this.prisma.campaignMember.create({
      data: {
        campaignId,
        userId: user.userId,
        campaignRole: createDto.role,
      },
      select: memberSelect,
    });
  }

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
      data: { campaignRole: updateDto.role as CampaignRole },
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
