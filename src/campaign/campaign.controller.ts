import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignService } from './campaign.service';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth('access-token')
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @ApiOperation({ summary: 'Create a campaign owned by the authenticated user' })
  @ApiBody({ type: CreateCampaignDto })
  @ApiCreatedResponse({ type: CampaignResponseDto })
  @ApiCommonErrors({ notFound: false })
  @Post()
  create(
    @Body() createDto: CreateCampaignDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.create(request.user.userId, createDto);
  }

  @ApiOperation({ summary: 'List campaigns owned by or shared with the authenticated user' })
  @ApiOkResponse({ type: CampaignResponseDto, isArray: true })
  @ApiCommonErrors({ badRequest: false, notFound: false })
  @Get()
  findAll(@Request() request: { user: TokenPayloadDto }) {
    return this.campaignService.findAll(request.user.userId);
  }

  @ApiOperation({ summary: 'Get an accessible campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  @ApiCommonErrors({ badRequest: false })
  @Get(':campaignId')
  findOne(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.findOne(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Update a campaign as its owner' })
  @ApiBody({ type: UpdateCampaignDto })
  @ApiOkResponse({ type: CampaignResponseDto })
  @ApiCommonErrors()
  @Patch(':campaignId')
  update(
    @Param('campaignId') campaignId: string,
    @Body() updateDto: UpdateCampaignDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.update(
      request.user.userId,
      campaignId,
      updateDto,
    );
  }

  @ApiOperation({ summary: 'Delete a campaign as its owner' })
  @ApiOkResponse({ description: 'Campaign deleted.' })
  @ApiCommonErrors({ badRequest: false })
  @Delete(':campaignId')
  remove(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.remove(request.user.userId, campaignId);
  }
}
