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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import {
  CreateInvestigationCardDto,
  UpdateInvestigationCardDto,
} from './dto/card.dto';
import {
  InvestigationBoardNodeResponseDto,
  InvestigationBoardResponseDto,
  InvestigationCardResponseDto,
  InvestigationLinkResponseDto,
} from './dto/investigation-board-response.dto';
import {
  CreateInvestigationLinkDto,
  UpdateInvestigationLinkDto,
} from './dto/link.dto';
import { UpdateInvestigationBoardNodeDto } from './dto/node.dto';
import { InvestigationBoardService } from './investigation-board.service';

@ApiTags('Investigation board')
@ApiBearerAuth('access-token')
@Controller()
export class InvestigationBoardController {
  constructor(private readonly boards: InvestigationBoardService) {}

  @ApiOperation({ summary: 'Get the campaign investigation board snapshot' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOkResponse({ type: InvestigationBoardResponseDto })
  @ApiCommonErrors({ badRequest: false })
  @Get('campaigns/:campaignId/investigation-board')
  get(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.getBoard(req.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Create a free or source-reference board card' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiCreatedResponse({ type: InvestigationCardResponseDto })
  @ApiCommonErrors({ conflict: true })
  @Post('campaigns/:campaignId/cards')
  createCard(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateInvestigationCardDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.createCard(req.user.userId, campaignId, dto);
  }

  @ApiOperation({ summary: 'Update board-specific card data' })
  @ApiParam({ name: 'cardId', format: 'uuid' })
  @ApiOkResponse({ type: InvestigationCardResponseDto })
  @ApiCommonErrors()
  @Patch('cards/:cardId')
  updateCard(
    @Param('cardId') cardId: string,
    @Body() dto: UpdateInvestigationCardDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateCard(req.user.userId, cardId, dto);
  }

  @ApiOperation({ summary: 'Delete a board card without deleting its source' })
  @ApiParam({ name: 'cardId', format: 'uuid' })
  @ApiOkResponse({ description: 'The card was deleted.' })
  @ApiCommonErrors({ badRequest: false })
  @Delete('cards/:cardId')
  deleteCard(
    @Param('cardId') cardId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.deleteCard(req.user.userId, cardId);
  }

  @ApiOperation({ summary: 'Create a link between two board cards' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiCreatedResponse({ type: InvestigationLinkResponseDto })
  @ApiCommonErrors({ conflict: true })
  @Post('campaigns/:campaignId/investigation-links')
  createLink(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateInvestigationLinkDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.createLink(req.user.userId, campaignId, dto);
  }

  @ApiOperation({ summary: 'Update a board link label' })
  @ApiParam({ name: 'linkId', format: 'uuid' })
  @ApiOkResponse({ type: InvestigationLinkResponseDto })
  @ApiCommonErrors()
  @Patch('investigation-links/:linkId')
  updateLink(
    @Param('linkId') linkId: string,
    @Body() dto: UpdateInvestigationLinkDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateLink(req.user.userId, linkId, dto);
  }

  @ApiOperation({ summary: 'Delete a board link' })
  @ApiParam({ name: 'linkId', format: 'uuid' })
  @ApiOkResponse({ description: 'The link was deleted.' })
  @ApiCommonErrors({ badRequest: false })
  @Delete('investigation-links/:linkId')
  deleteLink(
    @Param('linkId') linkId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.deleteLink(req.user.userId, linkId);
  }

  @ApiOperation({ summary: 'Update a board card node layout' })
  @ApiParam({ name: 'cardId', format: 'uuid' })
  @ApiOkResponse({ type: InvestigationBoardNodeResponseDto })
  @ApiCommonErrors()
  @Patch('investigation-board/nodes/:cardId')
  updateNode(
    @Param('cardId') cardId: string,
    @Body() dto: UpdateInvestigationBoardNodeDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateNode(req.user.userId, cardId, dto);
  }
}
