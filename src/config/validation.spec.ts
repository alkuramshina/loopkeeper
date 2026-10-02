import { validationSchema } from './validation';

const validEnvironment = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'loopkeeper',
  S3_ACCESS_KEY_ID: 'test-app',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_FORCE_PATH_STYLE: 'true',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/loopkeeper',
  JWT_SECRET: 'access-token-secret-with-enough-length',
  REFRESH_JWT_SECRET: 'refresh-token-secret-with-enough-length',
  INVITATION_SECRET: 'invitation-link-secret-with-enough-length',
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
      AUTH_THROTTLE_LIMIT: 5,
      S3_KEY_PREFIX: '',
      REFRESH_COOKIE_NAME: 'refresh_token',
      REFRESH_COOKIE_SECURE: false,
      REFRESH_COOKIE_SAMESITE: 'lax',
    });
  });

  it.each([
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_FORCE_PATH_STYLE',
  ])('requires %s', (key) => {
    const env = { ...validEnvironment } as Record<string, string>;
    delete env[key];
    expect(validationSchema.validate(env).error?.message).toContain(key);
  });
  it.each(['../other', '/root', 'one//two', 'one/../two', 'one\\two'])(
    'rejects unsafe prefix %s',
    (prefix) => {
      expect(
        validationSchema.validate({
          ...validEnvironment,
          S3_KEY_PREFIX: prefix,
        }).error?.message,
      ).toContain('S3_KEY_PREFIX');
    },
  );
  it.each([
    'http://user:password@localhost:9000',
    'http://localhost:9000/path',
    'ftp://localhost',
  ])('rejects unsafe endpoint %s', (endpoint) => {
    expect(
      validationSchema.validate({ ...validEnvironment, S3_ENDPOINT: endpoint })
        .error,
    ).toBeDefined();
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

  it('allows raising the auth limit for tests but not in production', () => {
    expect(
      validationSchema.validate({
        ...validEnvironment,
        NODE_ENV: 'test',
        AUTH_THROTTLE_LIMIT: 10_000,
      }).error,
    ).toBeUndefined();

    const { error } = validationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'production',
      REFRESH_COOKIE_SECURE: true,
      AUTH_THROTTLE_LIMIT: 10_000,
    });

    expect(error?.message).toContain('AUTH_THROTTLE_LIMIT');
  });
});
