import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignAccessService } from './access/campaign-access.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  create(userId: string, createDto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        system: 'TALES_FROM_THE_LOOP',
        coverUrl: createDto.coverUrl,
        ownerId: userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.campaign.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });

    if (!campaign) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'campaign.not_found',
        'The requested campaign is unavailable',
      );
    }

    return campaign;
  }

  async update(
    userId: string,
    campaignId: string,
    updateDto: UpdateCampaignDto,
  ) {
    await this.campaignAccess.requireOwner(userId, campaignId);

    return this.prisma.campaign.update({
      where: { campaignId },
      data: updateDto,
    });
  }

  async remove(userId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    await this.prisma.campaign.delete({ where: { campaignId } });
  }
}
