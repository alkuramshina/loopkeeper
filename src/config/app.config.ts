import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  environment: process.env.NODE_ENV ?? 'development',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  throttleTtl: Number(process.env.THROTTLE_TTL ?? 60_000),
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 100),
  authThrottleLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
}));
