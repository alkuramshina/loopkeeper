import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../common/exceptions/domain.exception';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async create(
    userId: string,
    campaignId: string,
    createDto: CreateLocationDto,
  ) {
    await this.campaignAccess.requireOwner(userId, campaignId);

    return this.prisma.campaignLocation.create({
      data: { ...createDto, campaignId, createdById: userId },
    });
  }

  async findAll(userId: string, campaignId: string) {
    await this.campaignAccess.requireBoardContributor(userId, campaignId);

    return this.prisma.campaignLocation.findMany({
      where: { campaignId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(userId: string, locationId: string) {
    const location = await this.findAccessibleLocation(userId, locationId);
    await this.campaignAccess.requireBoardContributor(
      userId,
      location.campaignId,
    );
    return location;
  }

  async update(
    userId: string,
    locationId: string,
    updateDto: UpdateLocationDto,
  ) {
    const location = await this.findAccessibleLocation(userId, locationId);
    await this.campaignAccess.requireOwner(userId, location.campaignId);

    return this.prisma.campaignLocation.update({
      where: { locationId },
      data: updateDto,
    });
  }

  async remove(userId: string, locationId: string) {
    const location = await this.findAccessibleLocation(userId, locationId);
    await this.campaignAccess.requireOwner(userId, location.campaignId);
    await this.prisma.campaignLocation.delete({ where: { locationId } });
  }

  private async findAccessibleLocation(userId: string, locationId: string) {
    const location = await this.prisma.campaignLocation.findFirst({
      where: {
        locationId,
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
    });

    if (!location) {
      throw this.locationNotFound();
    }

    return location;
  }

  private locationNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'Location not found',
    );
  }
}
