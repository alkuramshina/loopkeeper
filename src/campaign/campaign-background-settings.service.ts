import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignBackgroundSelectionMode, Prisma } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignAccessService } from './access/campaign-access.service';
import {
  CampaignBackgroundDto,
  UpdateCampaignBackgroundSettingsDto,
} from './dto/campaign-background-settings.dto';

type CampaignBackgroundSettings = {
  selectionMode: CampaignBackgroundSelectionMode;
  fixedBackgroundId: string | null;
  backgrounds: CampaignBackgroundDto[];
};

@Injectable()
export class CampaignBackgroundSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async findOne(userId: string, campaignId: string) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { campaignId },
      select: {
        backgroundSelectionMode: true,
        fixedBackgroundId: true,
        backgrounds: true,
      },
    });

    return this.present(campaign);
  }

  async update(
    userId: string,
    campaignId: string,
    updateDto: UpdateCampaignBackgroundSettingsDto,
  ) {
    await this.campaignAccess.requireOwner(userId, campaignId);
    this.validate(updateDto);

    const campaign = await this.prisma.campaign.update({
      where: { campaignId },
      data: {
        backgroundSelectionMode: updateDto.selectionMode,
        fixedBackgroundId: updateDto.fixedBackgroundId,
        backgrounds: updateDto.backgrounds as unknown as Prisma.InputJsonValue,
      },
      select: {
        backgroundSelectionMode: true,
        fixedBackgroundId: true,
        backgrounds: true,
      },
    });

    return this.present(campaign);
  }

  private validate(settings: UpdateCampaignBackgroundSettingsDto): void {
    const backgroundIds = settings.backgrounds.map(
      (background) => background.backgroundId,
    );
    if (new Set(backgroundIds).size !== backgroundIds.length) {
      throw this.invalidSettings('backgrounds', 'Background IDs must be unique');
    }

    if (settings.selectionMode === CampaignBackgroundSelectionMode.RANDOM) {
      if (settings.fixedBackgroundId !== null) {
        throw this.invalidSettings(
          'fixedBackgroundId',
          'A random background selection cannot have a fixed background',
        );
      }
      return;
    }

    const fixedBackground = settings.backgrounds.find(
      (background) => background.backgroundId === settings.fixedBackgroundId,
    );
    if (!fixedBackground?.isEnabled) {
      throw this.invalidSettings(
        'fixedBackgroundId',
        'The fixed background must exist and be enabled',
      );
    }
  }

  private present(campaign: {
    backgroundSelectionMode: CampaignBackgroundSelectionMode;
    fixedBackgroundId: string | null;
    backgrounds: Prisma.JsonValue;
  }): CampaignBackgroundSettings {
    return {
      selectionMode: campaign.backgroundSelectionMode,
      fixedBackgroundId: campaign.fixedBackgroundId,
      backgrounds: campaign.backgrounds as unknown as CampaignBackgroundDto[],
    };
  }

  private invalidSettings(field: string, message: string): DomainException {
    return new DomainException(
      HttpStatus.BAD_REQUEST,
      'campaign.background_settings.invalid',
      message,
      [{ field, code: 'invalid' }],
    );
  }
}
