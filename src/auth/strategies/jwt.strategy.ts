import { Inject, Injectable } from "@nestjs/common";
import { type ConfigType } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtPayload } from "jsonwebtoken";
import { TokenPayloadDto } from "../dto/token-payload.dto";
import jwtConfig from "../config/jwt.config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(@Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<TokenPayloadDto> {
    return {
      userId: payload.sub!,
      username: payload.username as string,
    };
  }
}