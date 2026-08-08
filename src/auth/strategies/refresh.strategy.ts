import { Inject, Injectable } from "@nestjs/common";
import { type ConfigType } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtPayload } from "jsonwebtoken";
import { TokenPayloadDto } from "../dto/token-payload.dto";
import jwtConfig from "../config/jwt.config";

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {

  constructor(@Inject(jwtConfig.KEY) jwtTokenConfig: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.cookies?.[jwtTokenConfig.refreshCookieName],
      ]),
      secretOrKey: jwtTokenConfig.refreshSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<TokenPayloadDto> {
    return {
      userId: payload.sub!,
      username: payload.username
    };
  }
}