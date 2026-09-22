import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { CampaignAccessService } from './access/campaign-access.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';

const invitationSelect = {
  invitationId: true,
  campaignId: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  createdById: true,
} as const;

@Injectable()
export class CampaignInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async create(
    ownerId: string,
    campaignId: string,
    createDto: CreateInvitationDto,
  ) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const secret = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.campaignInvitation.create({
      data: {
        campaignId,
        createdById: ownerId,
        role: createDto.role,
        tokenHash: await argon2.hash(secret),
        expiresAt: this.getExpiryDate(),
      },
      select: invitationSelect,
    });

    return { ...invitation, token: `${invitation.invitationId}.${secret}` };
  }

  async findAll(ownerId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    return this.prisma.campaignInvitation.findMany({
      where: { campaignId },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(ownerId: string, campaignId: string, invitationId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const result = await this.prisma.campaignInvitation.updateMany({
      where: { invitationId, campaignId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Invitation not found');
    }
  }

  async accept(userId: string, token: string) {
    const [invitationId, secret, ...extraParts] = token.split('.');
    if (!invitationId || !secret || extraParts.length > 0) {
      throw new NotFoundException('Invitation not found');
    }

    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { invitationId },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      !(await argon2.verify(invitation.tokenHash, secret))
    ) {
      throw new NotFoundException('Invitation not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.campaignMember.findUnique({
        where: {
          userId_campaignId: { userId, campaignId: invitation.campaignId },
        },
      });
      const campaign = await tx.campaign.findUnique({
        where: { campaignId: invitation.campaignId },
        select: { ownerId: true },
      });

      if (!campaign || campaign.ownerId === userId) {
        throw new ConflictException('User is already a campaign member');
      }
      if (existingMember) {
        throw new ConflictException('User is already a campaign member');
      }

      const claimed = await tx.campaignInvitation.updateMany({
        where: {
          invitationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new NotFoundException('Invitation not found');
      }

      return tx.campaignMember.create({
        data: {
          campaignId: invitation.campaignId,
          userId,
          campaignRole: invitation.role,
        },
        select: {
          memberId: true,
          campaignId: true,
          campaignRole: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  }

  private getExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }
}
