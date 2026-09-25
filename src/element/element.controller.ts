import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CampaignElementAccess, CampaignElementType } from '@prisma/client';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import {
  CreateElementDto,
  ElementResponseDto,
  UpdateElementDto,
} from './dto/element.dto';
import { ElementService } from './element.service';

@ApiTags('Campaign elements')
@ApiBearerAuth('access-token')
@Controller()
export class ElementController {
  constructor(private readonly elements: ElementService) {}

  @Post('campaigns/:campaignId/elements')
  @ApiCreatedResponse({ type: ElementResponseDto })
  create(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateElementDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.create(request.user.userId, campaignId, dto);
  }

  @Get('campaigns/:campaignId/elements')
  @ApiQuery({ name: 'type', required: false, enum: CampaignElementType })
  @ApiOkResponse({ type: ElementResponseDto, isArray: true })
  findAll(
    @Param('campaignId') campaignId: string,
    @Query('type', new ParseEnumPipe(CampaignElementType, { optional: true }))
    type: CampaignElementType | undefined,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.findAll(request.user.userId, campaignId, type);
  }

  @Get('elements/:elementId')
  @ApiOkResponse({ type: ElementResponseDto })
  findOne(
    @Param('elementId') elementId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.findOne(request.user.userId, elementId);
  }

  @Patch('elements/:elementId')
  @ApiOkResponse({ type: ElementResponseDto })
  update(
    @Param('elementId') elementId: string,
    @Body() dto: UpdateElementDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.update(request.user.userId, elementId, dto);
  }

  @Post('elements/:elementId/publish')
  @ApiCreatedResponse({ type: ElementResponseDto })
  publish(
    @Param('elementId') elementId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.setAccess(request.user.userId, elementId, CampaignElementAccess.SHARED);
  }

  @Post('elements/:elementId/hide')
  @ApiCreatedResponse({ type: ElementResponseDto })
  hide(
    @Param('elementId') elementId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.setAccess(request.user.userId, elementId, CampaignElementAccess.MASTER_ONLY);
  }

  @Delete('elements/:elementId')
  remove(
    @Param('elementId') elementId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.elements.remove(request.user.userId, elementId);
  }
}
