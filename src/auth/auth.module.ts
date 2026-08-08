import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersService } from '../users/users.service';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt.guard';
import type { SignOptions } from 'jsonwebtoken';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        const expiresIn = config.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN') ?? '1h';

        return {
          secret,
          signOptions: { expiresIn },
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService, LocalStrategy, JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    }],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }
