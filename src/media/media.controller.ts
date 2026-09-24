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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth('access-token')
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
  @UseInterceptors(FileInterceptor('file'))
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

  @ApiOperation({ summary: 'Get an authenticated user avatar' })
  @ApiOkResponse({ description: 'Normalized WebP avatar image' })
  @Get('media/:assetId')
  async getAvatar(
    @Request() request: { user: TokenPayloadDto },
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const content = await this.mediaService.getAvatarContent(
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
