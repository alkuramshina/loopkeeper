import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CampaignInvitationService } from './campaign-invitation.service';
import {
  CampaignInvitationResponseDto,
  CreatedCampaignInvitationResponseDto,
} from './dto/campaign-invitation-response.dto';
import { AcceptedCampaignMemberResponseDto } from './dto/campaign-member-response.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@ApiTags('Campaign invitations')
@ApiBearerAuth('access-token')
@Controller()
export class CampaignInvitationController {
  constructor(private readonly invitations: CampaignInvitationService) {}

  @ApiOperation({ summary: 'Create an invitation for an owned campaign' })
  @ApiBody({ type: CreateInvitationDto })
  @ApiCreatedResponse({ type: CreatedCampaignInvitationResponseDto })
  @Post('campaigns/:campaignId/invitations')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateInvitationDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.create(request.user.userId, campaignId, createDto);
  }

  @ApiOperation({ summary: 'List invitations for an owned campaign' })
  @ApiOkResponse({ type: CampaignInvitationResponseDto, isArray: true })
  @Get('campaigns/:campaignId/invitations')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.findAll(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Revoke a pending campaign invitation' })
  @ApiOkResponse({ description: 'Invitation revoked.' })
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

  @ApiOperation({ summary: 'Accept a campaign invitation' })
  @ApiCreatedResponse({ type: AcceptedCampaignMemberResponseDto })
  @Post('invitations/:token/accept')
  accept(
    @Param('token') token: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.invitations.accept(request.user.userId, token);
  }
}
