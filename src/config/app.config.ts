import { registerAs } from "@nestjs/config";

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  environment: process.env.NODE_ENV ?? 'development',
}));