process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_jwt_secret_1234567890';
process.env.REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET ?? 'test_refresh_secret_1234567890';
process.env.REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
process.env.REFRESH_COOKIE_SECURE = process.env.REFRESH_COOKIE_SECURE ?? 'false';
process.env.REFRESH_COOKIE_SAMESITE = process.env.REFRESH_COOKIE_SAMESITE ?? 'lax';
