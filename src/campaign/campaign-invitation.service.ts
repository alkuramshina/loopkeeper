import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignRole } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainException } from '../common/exceptions/domain.exception';
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
  acceptedBy: {
    select: { userId: true, email: true, name: true, avatarUrl: true },
  },
} as const;

@Injectable()
export class CampaignInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
    private readonly config: ConfigService,
  ) {}

  async create(
    ownerId: string,
    campaignId: string,
    createDto: CreateInvitationDto,
  ) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const invitation = await this.prisma.campaignInvitation.create({
      data: {
        campaignId,
        createdById: ownerId,
        role: createDto.role,
        expiresAt: this.getExpiryDate(),
      },
      select: invitationSelect,
    });

    return this.withToken(invitation);
  }

  async findAll(ownerId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const invitations = await this.prisma.campaignInvitation.findMany({
      where: { campaignId },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => this.withToken(invitation));
  }

  async revoke(ownerId: string, campaignId: string, invitationId: string) {
    await this.campaignAccess.requireOwner(ownerId, campaignId);

    const result = await this.prisma.campaignInvitation.updateMany({
      where: { invitationId, campaignId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw this.invitationNotFound();
    }
  }

  // Public: the token itself is the secret, so the answer is limited to what
  // the invitee needs to recognise the invitation before signing in.
  async preview(token: string) {
    const invitation = await this.findUsableInvitation(token);
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { campaignId: invitation.campaignId },
      select: {
        title: true,
        members: {
          where: { campaignRole: CampaignRole.OWNER },
          select: { user: { select: { name: true } } },
          take: 1,
        },
      },
    });

    return {
      campaignTitle: campaign.title,
      masterName: campaign.members[0]?.user.name ?? null,
      role: invitation.role,
    };
  }

  async accept(userId: string, token: string) {
    const invitation = await this.findUsableInvitation(token);
    const { invitationId } = invitation;

    return this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.campaignMember.findUnique({
        where: {
          userId_campaignId: { userId, campaignId: invitation.campaignId },
        },
      });
      // The owner already has a membership row, so this covers them too.
      if (existingMember) {
        throw this.alreadyMember();
      }

      const claimed = await tx.campaignInvitation.updateMany({
        where: {
          invitationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedById: userId },
      });
      if (claimed.count === 0) {
        throw this.invitationNotFound();
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

  private async findUsableInvitation(token: string) {
    const [invitationId, secret, ...extraParts] = token.split('.');
    if (!invitationId || !secret || extraParts.length > 0) {
      throw this.invitationNotFound();
    }

    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { invitationId },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      !this.secretMatches(invitation.invitationId, secret)
    ) {
      throw this.invitationNotFound();
    }

    return invitation;
  }

  /**
   * The link secret is an HMAC of the invitation id under a server key, so
   * the master can copy an active link again while the database alone does
   * not reveal it. Only a usable invitation gets its link back.
   */
  private withToken<
    T extends {
      invitationId: string;
      acceptedAt: Date | null;
      revokedAt: Date | null;
      expiresAt: Date;
    },
  >(invitation: T) {
    const usable =
      !invitation.acceptedAt &&
      !invitation.revokedAt &&
      invitation.expiresAt > new Date();
    return {
      ...invitation,
      token: usable
        ? `${invitation.invitationId}.${this.linkSecret(invitation.invitationId)}`
        : null,
    };
  }

  private linkSecret(invitationId: string): string {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('INVITATION_SECRET'),
    )
      .update(invitationId)
      .digest('base64url');
  }

  private secretMatches(invitationId: string, secret: string): boolean {
    const expected = Buffer.from(this.linkSecret(invitationId));
    const given = Buffer.from(secret);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private invitationNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'invitation.not_found',
      'Invitation not found',
    );
  }

  private alreadyMember(): DomainException {
    return new DomainException(
      HttpStatus.CONFLICT,
      'invitation.already_member',
      'User is already a campaign member',
    );
  }

  private getExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }
}
