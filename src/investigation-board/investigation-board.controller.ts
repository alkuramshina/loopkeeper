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
import {
  CreateInvestigationCardDto,
  UpdateInvestigationCardDto,
} from './dto/card.dto';
import {
  CreateInvestigationLinkDto,
  UpdateInvestigationLinkDto,
} from './dto/link.dto';
import { UpdateInvestigationBoardNodeDto } from './dto/node.dto';
import { InvestigationBoardService } from './investigation-board.service';

@Controller()
export class InvestigationBoardController {
  constructor(private readonly boards: InvestigationBoardService) {}
  @Get('campaigns/:campaignId/investigation-board') get(
    @Param('campaignId') campaignId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.getBoard(req.user.userId, campaignId);
  }
  @Post('campaigns/:campaignId/investigation-cards') createCard(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateInvestigationCardDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.createCard(req.user.userId, campaignId, dto);
  }
  @Patch('investigation-cards/:cardId') updateCard(
    @Param('cardId') cardId: string,
    @Body() dto: UpdateInvestigationCardDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateCard(req.user.userId, cardId, dto);
  }
  @Delete('investigation-cards/:cardId') deleteCard(
    @Param('cardId') cardId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.deleteCard(req.user.userId, cardId);
  }
  @Post('campaigns/:campaignId/investigation-links') createLink(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateInvestigationLinkDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.createLink(req.user.userId, campaignId, dto);
  }
  @Patch('investigation-links/:linkId') updateLink(
    @Param('linkId') linkId: string,
    @Body() dto: UpdateInvestigationLinkDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateLink(req.user.userId, linkId, dto);
  }
  @Delete('investigation-links/:linkId') deleteLink(
    @Param('linkId') linkId: string,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.deleteLink(req.user.userId, linkId);
  }
  @Patch('investigation-board/nodes/:cardId') updateNode(
    @Param('cardId') cardId: string,
    @Body() dto: UpdateInvestigationBoardNodeDto,
    @Request() req: { user: TokenPayloadDto },
  ) {
    return this.boards.updateNode(req.user.userId, cardId, dto);
  }
}
