import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCampaignDto } from './create-campaign.dto';

export class UpdateCampaignDto extends PartialType(
  OmitType(CreateCampaignDto, ['system'] as const),
) {}
