import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import {
  MAX_MEDIA_BYTES,
  MediaUploadExceptionFilter,
} from './media-upload-exception.filter';
import { MediaService } from './media.service';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { CampaignBackgroundDto } from '../campaign/dto/campaign-background-settings.dto';

const uploadOptions = {
  limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 0 },
};

@ApiTags('Media')
@ApiBearerAuth('access-token')
@UseFilters(MediaUploadExceptionFilter)
@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @ApiOperation({ summary: 'Upload and set the authenticated user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', format: 'uuid' },
        avatarUrl: { type: 'string' },
      },
    },
  })
  @Post('users/me/avatar')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadAvatar(
    @Request() request: { user: TokenPayloadDto },
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.mediaService.replaceAvatar(request.user.userId, file);
  }

  @ApiOperation({ summary: 'Delete the authenticated user avatar' })
  @ApiNoContentResponse()
  @Delete('users/me/avatar')
  @HttpCode(204)
  async deleteAvatar(
    @Request() request: { user: TokenPayloadDto },
  ): Promise<void> {
    await this.mediaService.deleteAvatar(request.user.userId);
  }

  @ApiOperation({ summary: 'Upload and set a character avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @Post('characters/:characterId/avatar')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadCharacterAvatar(
    @Request() request: { user: TokenPayloadDto },
    @Param('characterId') characterId: string,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.mediaService.replaceCharacterAvatar(
      request.user.userId,
      characterId,
      file,
    );
  }

  @ApiOperation({ summary: 'Delete a character avatar' })
  @ApiNoContentResponse()
  @Delete('characters/:characterId/avatar')
  @HttpCode(204)
  async deleteCharacterAvatar(
    @Request() request: { user: TokenPayloadDto },
    @Param('characterId') characterId: string,
  ): Promise<void> {
    await this.mediaService.deleteCharacterAvatar(
      request.user.userId,
      characterId,
    );
  }

  @ApiOperation({
    summary:
      'Upload and set a campaign cover (landscape 3:2–2:1, 640–2048 pixels wide and 360–2048 pixels high; normalized without cropping to at most 1280×720)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @Post('campaigns/:campaignId/cover')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadCampaignCover(
    @Request() request: { user: TokenPayloadDto },
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.mediaService.replaceCampaignCover(
      request.user.userId,
      campaignId,
      file,
    );
  }

  @ApiOperation({ summary: 'Delete a campaign cover' })
  @ApiNoContentResponse()
  @Delete('campaigns/:campaignId/cover')
  @HttpCode(204)
  async deleteCampaignCover(
    @Request() request: { user: TokenPayloadDto },
    @Param('campaignId') campaignId: string,
  ): Promise<void> {
    await this.mediaService.deleteCampaignCover(
      request.user.userId,
      campaignId,
    );
  }

  @ApiOperation({
    summary:
      'Add a local campaign background (1600×900, 1920×1080 or 2560×1440 JPEG/PNG/WebP, at most 5 MiB)',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: CampaignBackgroundDto })
  @ApiCommonErrors()
  @Post('campaigns/:campaignId/backgrounds')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadCampaignBackground(
    @Request() request: { user: TokenPayloadDto },
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.mediaService.addCampaignBackground(
      request.user.userId,
      campaignId,
      file,
    );
  }

  @ApiOperation({ summary: 'Delete a local campaign background' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiParam({ name: 'backgroundId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiCommonErrors({ badRequest: false })
  @Delete('campaigns/:campaignId/backgrounds/:backgroundId')
  @HttpCode(204)
  async deleteCampaignBackground(
    @Request() request: { user: TokenPayloadDto },
    @Param('campaignId') campaignId: string,
    @Param('backgroundId') backgroundId: string,
  ): Promise<void> {
    await this.mediaService.deleteCampaignBackground(
      request.user.userId,
      campaignId,
      backgroundId,
    );
  }

  @ApiOperation({ summary: 'Get an authorized media asset' })
  @ApiOkResponse({ description: 'Normalized WebP image' })
  @Get('media/:assetId')
  async getMedia(
    @Request() request: { user: TokenPayloadDto },
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const content = await this.mediaService.getMediaContent(
      request.user.userId,
      assetId,
    );

    response
      .status(200)
      .set({
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      })
      .send(content);
  }
}
