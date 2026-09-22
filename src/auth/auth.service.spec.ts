import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import jwtConfig from './config/jwt.config';

describe('AuthService', () => {
  it('is defined with its dependencies', () => {
    const jwtTokenConfig: ConfigType<typeof jwtConfig> = {
      secret: 'access-secret',
      expiresIn: '1h',
      refreshSecret: 'refresh-secret',
      refreshExpiresIn: '7d',
      refreshCookieName: 'refresh_token',
      refreshCookieSecure: false,
      refreshCookieSameSite: 'lax',
    };
    const service = new AuthService(
      {} as UserService,
      {} as PrismaService,
      {} as JwtService,
      jwtTokenConfig,
    );

    expect(service).toBeDefined();
  });
});
