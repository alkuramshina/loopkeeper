import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from 'jsonwebtoken';
import { DomainException } from '../../common/exceptions/domain.exception';
import { AuthService } from '../auth.service';
import jwtConfig from '../config/jwt.config';
import { TokenPayloadDto } from '../dto/token-payload.dto';

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtTokenConfig: ConfigType<typeof jwtConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.cookies?.[jwtTokenConfig.refreshCookieName],
      ]),
      secretOrKey: jwtTokenConfig.refreshSecret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    request: { cookies?: Record<string, string> },
    payload: JwtPayload,
  ): Promise<TokenPayloadDto> {
    const userId = payload.sub;
    const sessionId = payload.sid;
    const refreshToken =
      request.cookies?.[this.jwtTokenConfig.refreshCookieName];

    if (
      typeof userId !== 'string' ||
      typeof sessionId !== 'string' ||
      typeof refreshToken !== 'string'
    ) {
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'auth.refresh_invalid',
        'The refresh session is invalid',
      );
    }

    return this.authService.validateRefreshSession(userId, sessionId, refreshToken);
  }
}
