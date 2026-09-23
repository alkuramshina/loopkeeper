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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignMemberService } from './campaign-member.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('Campaign members')
@ApiBearerAuth('access-token')
@Controller('campaigns/:campaignId/members')
export class CampaignMemberController {
  constructor(private readonly members: CampaignMemberService) {}

  @Post()
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateMemberDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.create(request.user.userId, campaignId, createDto);
  }

  @Get()
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.findAll(request.user.userId, campaignId);
  }

  @Patch(':userId')
  update(
    @Param('campaignId') campaignId: string,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateMemberDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.update(
      request.user.userId,
      campaignId,
      userId,
      updateDto,
    );
  }

  @Delete(':userId')
  remove(
    @Param('campaignId') campaignId: string,
    @Param('userId') userId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.remove(request.user.userId, campaignId, userId);
  }
}
