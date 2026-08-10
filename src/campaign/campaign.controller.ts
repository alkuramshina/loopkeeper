import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Post()
  async create(@Body() createDto: CreateCampaignDto, @Request() request) {
    return await this.campaignService.create(request.user.userId, createDto);
  }

  @Get()
  async findAll() {
    return await this.campaignService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.campaignService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateCampaignDto) {
    return await this.campaignService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.campaignService.remove(id);
  }
}
