import { Body, Controller, Get, Param, Patch, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { CampaignBackgroundSettingsService } from './campaign-background-settings.service';
import {
  CampaignBackgroundSettingsResponseDto,
  UpdateCampaignBackgroundSettingsDto,
} from './dto/campaign-background-settings.dto';

@ApiTags('Campaign background settings')
@ApiBearerAuth('access-token')
@Controller('campaigns/:campaignId/background-settings')
export class CampaignBackgroundSettingsController {
  constructor(
    private readonly backgroundSettings: CampaignBackgroundSettingsService,
  ) {}

  @ApiOperation({ summary: 'Get background settings for an owned campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOkResponse({ type: CampaignBackgroundSettingsResponseDto })
  @ApiCommonErrors({ badRequest: false })
  @Get()
  findOne(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.backgroundSettings.findOne(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Update background settings for an owned campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiBody({ type: UpdateCampaignBackgroundSettingsDto })
  @ApiOkResponse({ type: CampaignBackgroundSettingsResponseDto })
  @ApiCommonErrors()
  @Patch()
  update(
    @Param('campaignId') campaignId: string,
    @Body() updateDto: UpdateCampaignBackgroundSettingsDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.backgroundSettings.update(
      request.user.userId,
      campaignId,
      updateDto,
    );
  }
}
