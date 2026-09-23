import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignInvitationService } from './campaign-invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@ApiTags('Campaign invitations')
@ApiBearerAuth('access-token')
@Controller()
export class CampaignInvitationController {
  constructor(private readonly invitations: CampaignInvitationService) {}

  @Post('campaigns/:campaignId/invitations')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateInvitationDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.create(request.user.userId, campaignId, createDto);
  }

  @Get('campaigns/:campaignId/invitations')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.findAll(request.user.userId, campaignId);
  }

  @Delete('campaigns/:campaignId/invitations/:invitationId')
  revoke(
    @Param('campaignId') campaignId: string,
    @Param('invitationId') invitationId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.revoke(
      request.user.userId,
      campaignId,
      invitationId,
    );
  }

  @Post('invitations/:token/accept')
  accept(
    @Param('token') token: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.accept(request.user.userId, token);
  }
}
