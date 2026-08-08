import { registerAs } from '@nestjs/config';

export default registerAs('jwt', (): { secret: string; expiresIn: string } => ({
  secret: process.env.JWT_SECRET as string,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
}));