import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,

  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignMemberService } from './campaign-member.service';
import { CampaignMemberResponseDto } from './dto/campaign-member-response.dto';

import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('Campaign members')
@ApiBearerAuth('access-token')
@Controller('campaigns/:campaignId/members')
export class CampaignMemberController {
  constructor(private readonly members: CampaignMemberService) {}


  @ApiOperation({ summary: 'List members of an owned campaign' })
  @ApiOkResponse({ type: CampaignMemberResponseDto, isArray: true })
  @Get()
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.findAll(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Update a member role in an owned campaign' })
  @ApiBody({ type: UpdateMemberDto })
  @ApiOkResponse({ type: CampaignMemberResponseDto })
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

  @ApiOperation({ summary: 'Remove a member from an owned campaign' })
  @ApiOkResponse({ description: 'Member removed.' })
  @Delete(':userId')
  remove(
    @Param('campaignId') campaignId: string,
    @Param('userId') userId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.members.remove(request.user.userId, campaignId, userId);
  }
}
