import { ConfigType } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import jwtConfig from './config/jwt.config';

describe('AuthController', () => {
  it('is defined with auth service and JWT configuration', () => {
    const jwtTokenConfig: ConfigType<typeof jwtConfig> = {
      secret: 'access-secret',
      expiresIn: '1h',
      refreshSecret: 'refresh-secret',
      refreshExpiresIn: '7d',
      refreshCookieName: 'refresh_token',
      refreshCookieSecure: false,
      refreshCookieSameSite: 'lax',
    };
    const controller = new AuthController(
      {} as AuthService,
      jwtTokenConfig,
    );

    expect(controller).toBeDefined();
  });
});
