import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { RecordViewsDto } from './dto/record-views.dto';
import { EntityViewService } from './entity-view.service';

@ApiTags('Entity views')
@ApiBearerAuth('access-token')
@Controller('campaigns/:campaignId/views')
export class EntityViewController {
  constructor(private readonly views: EntityViewService) {}

  @Post()
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Record the first view of a batch of currently visible entities for the current member',
  })
  @ApiBody({ type: RecordViewsDto })
  @ApiNoContentResponse({
    description: 'Views recorded; repeated entries keep their first timestamp.',
  })
  @ApiCommonErrors()
  record(
    @Request() request: { user: TokenPayloadDto },
    @Param('campaignId') campaignId: string,
    @Body() dto: RecordViewsDto,
  ) {
    return this.views.record(request.user.userId, campaignId, dto);
  }
}
