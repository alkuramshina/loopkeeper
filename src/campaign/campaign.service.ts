import { Injectable } from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, createDto: CreateCampaignDto) {
    return await this.prisma.campaign.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        system: 'TALES_FROM_THE_LOOP',
        coverUrl: createDto.coverUrl,
        ownerId: userId
      },
    });
  }

  async findAll() {
    return await this.prisma.campaign.findMany();
  }

  async findOne(id: string) {
    return await this.prisma.campaign.findFirst({
      where: {
        campaignId: id,
      },
    });
  }

  async update(id: string, updateDto: UpdateCampaignDto) {
    return await this.prisma.campaign.update({
      where: { campaignId: id },
      data: {
        title: updateDto.title,
        description: updateDto.description,
        coverUrl: updateDto.coverUrl
      },
    });
  }

  async remove(id: string) {
    await this.prisma.campaign.delete({
      where: { campaignId: id },
    });
  }
}
