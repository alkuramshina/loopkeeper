import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { MediaService } from './media.service';

// Guards run before interceptors, so a map upload is authorized before
// multer starts writing the request body to a temporary file.
@Injectable()
export class LocationMapUploadGuard implements CanActivate {
  constructor(private readonly media: MediaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: TokenPayloadDto;
      params: { elementId: string };
    }>();
    await this.media.requireEditableElement(
      request.user.userId,
      request.params.elementId,
      true,
    );
    return true;
  }
}
