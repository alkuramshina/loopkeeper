import { Inject, Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as argon2 from 'argon2';
import { TokenDto, TokenPayloadDto } from './dto/token-payload.dto';
import jwtConfig from './config/jwt.config';
import { type ConfigType } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject(jwtConfig.KEY) private jwtTokenConfig: ConfigType<typeof jwtConfig>
  ) { }

  async validateUser(username: string, pass: string): Promise<TokenPayloadDto | null> {
    const user = await this.userService.findOne(username);
    if (user && await argon2.verify(user.passwordHash, pass)) {
      const { passwordHash, ...result } = user;
      return {
        ...result,
        username: user.email,
      };
    }

    return null;
  }

  async generateUserTokens(user: TokenPayloadDto): Promise<TokenDto> {
    const payload = { username: user.username, sub: user.userId };
    const refreshOptions: JwtSignOptions = {
      secret: this.jwtTokenConfig.refreshSecret,
      expiresIn: this.jwtTokenConfig.refreshExpiresIn as JwtSignOptions['expiresIn'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.sign(payload),
      this.jwtService.sign(payload, refreshOptions)
    ]);

    return { accessToken, refreshToken };
  }
}
