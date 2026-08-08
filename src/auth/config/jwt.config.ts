import { registerAs } from '@nestjs/config';

export default registerAs('jwt', (): {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: 'lax' | 'strict' | 'none';
} => ({
  secret: process.env.JWT_SECRET as string,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  refreshSecret: process.env.REFRESH_JWT_SECRET as string,
  refreshExpiresIn: process.env.REFRESH_JWT_EXPIRES_IN ?? '7d',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME as string,
  refreshCookieSecure: process.env.REFRESH_COOKIE_SECURE === 'true',
  refreshCookieSameSite: process.env.REFRESH_COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
}));