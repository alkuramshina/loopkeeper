import {
  Controller,
  Logger,
  HttpStatus,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBodyOptions,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiOperation,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { DomainException } from '../common/exceptions/domain.exception';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { LocationMapUploadGuard } from './location-map-upload.guard';
import {
  MAX_MAP_BYTES,
  MAX_MEDIA_BYTES,
  MediaUploadExceptionFilter,
} from './media-upload-exception.filter';
import { MediaService } from './media.service';
import { TemporaryFileStorage } from './temporary-file-storage';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { ApiErrorResponseDto } from '../common/swagger/error-response.dto';

const uploadOptions = {
  // Busboy treats its byte threshold as exclusive; allow the documented limit.
  limits: { fileSize: MAX_MEDIA_BYTES + 1, files: 1, fields: 0 },
};

// Location maps may be larger, so they are streamed to a temporary file.
const mapUploadOptions = {
  storage: new TemporaryFileStorage(),
  limits: { fileSize: MAX_MAP_BYTES + 1, files: 1, fields: 0 },
};

const fileBody: ApiBodyOptions = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('Media')
@ApiBearerAuth('access-token')
@UseFilters(MediaUploadExceptionFilter)
@Controller()
@ApiServiceUnavailableResponse({
  type: ApiErrorResponseDto,
  description:
    'media.storage_unavailable: media storage is temporarily unavailable',
})
export class MediaController {
  private readonly logger = new Logger(MediaController.name);
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
      'Upload and set an element cover (author only; JPEG/PNG/WebP up to 5 MiB, 256–4096 pixels per side, aspect ratio 1:2–2:1; normalized to at most 1024×1024 WebP)',
  })
  @ApiParam({ name: 'elementId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', format: 'uuid' },
        coverUrl: { type: 'string' },
      },
    },
  })
  @ApiCommonErrors()
  @Post('elements/:elementId/cover')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadElementCover(
    @Request() request: { user: TokenPayloadDto },
    @Param('elementId') elementId: string,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.mediaService.replaceElementCover(
      request.user.userId,
      elementId,
      file,
    );
  }

  @ApiOperation({ summary: 'Delete an element cover (author only)' })
  @ApiParam({ name: 'elementId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiCommonErrors({ badRequest: false })
  @Delete('elements/:elementId/cover')
  @HttpCode(204)
  async deleteElementCover(
    @Request() request: { user: TokenPayloadDto },
    @Param('elementId') elementId: string,
  ): Promise<void> {
    await this.mediaService.deleteElementCover(request.user.userId, elementId);
  }

  @ApiOperation({
    summary:
      'Upload and set a location map (author of a LOCATION only; JPEG/PNG/WebP up to 10 MiB, long side 1024–8192 pixels, short side at least 256, at most 40 megapixels; normalized to at most 4096 pixels per side WebP)',
  })
  @ApiParam({ name: 'elementId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', format: 'uuid' },
        imageUrl: { type: 'string' },
      },
    },
  })
  @ApiCommonErrors()
  @Post('elements/:elementId/map')
  @UseGuards(LocationMapUploadGuard)
  @UseInterceptors(FileInterceptor('file', mapUploadOptions))
  uploadLocationMap(
    @Request() request: { user: TokenPayloadDto },
    @Param('elementId') elementId: string,
    @UploadedFile() file: { path: string } | undefined,
  ) {
    return this.mediaService.replaceLocationMap(
      request.user.userId,
      elementId,
      file,
    );
  }

  @ApiOperation({ summary: 'Delete an uploaded location map (author only)' })
  @ApiParam({ name: 'elementId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiCommonErrors({ badRequest: false })
  @Delete('elements/:elementId/map')
  @HttpCode(204)
  async deleteLocationMap(
    @Request() request: { user: TokenPayloadDto },
    @Param('elementId') elementId: string,
  ): Promise<void> {
    await this.mediaService.deleteLocationMap(request.user.userId, elementId);
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

    const disconnect = () => content.body.destroy();
    response.once('close', disconnect);
    // Wait for the first bytes before committing image headers. An upstream
    // read failure can still use the normal safe API error response here.
    const chunks = content.body[Symbol.asyncIterator]();
    let first: IteratorResult<Buffer>;
    try {
      first = await chunks.next();
      if (first.done && content.byteSize > 0) {
        throw new Error('Media stream ended before its first bytes');
      }
    } catch {
      response.off('close', disconnect);
      content.body.destroy();
      if (response.destroyed) return;
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'media.storage_unavailable',
        'Media storage is temporarily unavailable',
      );
    }
    if (response.destroyed) {
      content.body.destroy();
      return;
    }
    const output = Readable.from(
      (async function* () {
        if (!first.done) yield first.value;
        for await (const chunk of chunks) yield chunk;
      })(),
    );
    response.status(200).set({
      'Content-Type': 'image/webp',
      'Content-Length': String(content.byteSize),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    });
    try {
      await pipeline(output, response);
    } catch {
      this.logger.warn('Media response stream closed before completion');
      response.destroy();
    } finally {
      response.off('close', disconnect);
      content.body.destroy();
    }
  }
}
