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
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  create(
    @Body() createDto: CreateCampaignDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.create(request.user.userId, createDto);
  }

  @Get()
  findAll(@Request() request: { user: TokenPayloadDto }) {
    return this.campaignService.findAll(request.user.userId);
  }

  @Get(':campaignId')
  findOne(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.findOne(request.user.userId, campaignId);
  }

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

  @Delete(':campaignId')
  remove(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.campaignService.remove(request.user.userId, campaignId);
  }
}
