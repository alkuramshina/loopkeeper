import { validationSchema } from './validation';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/loopkeeper',
  JWT_SECRET: 'access-token-secret-with-enough-length',
  REFRESH_JWT_SECRET: 'refresh-token-secret-with-enough-length',
};

describe('validationSchema', () => {
  it('applies safe local defaults', () => {
    const { error, value } = validationSchema.validate(validEnvironment);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      FRONTEND_URL: 'http://localhost:3000',
      THROTTLE_TTL: 60_000,
      THROTTLE_LIMIT: 100,
      REFRESH_COOKIE_NAME: 'refresh_token',
      REFRESH_COOKIE_SECURE: false,
      REFRESH_COOKIE_SAMESITE: 'lax',
    });
  });

  it('requires secure cookies when SameSite is none', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      REFRESH_COOKIE_SAMESITE: 'none',
      REFRESH_COOKIE_SECURE: false,
    });

    expect(error?.message).toContain('REFRESH_COOKIE_SECURE');
  });

  it('requires secure cookies in production', () => {
    const { error } = validationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'production',
      REFRESH_COOKIE_SECURE: false,
    });

    expect(error?.message).toContain('REFRESH_COOKIE_SECURE');
  });
});
