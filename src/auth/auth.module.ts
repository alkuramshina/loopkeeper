import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt.guard';
import { UserModule } from '../user/user.module';
import jwtConfig from './config/jwt.config';
import type { SignOptions } from 'jsonwebtoken';

@Module({
  imports: [
    PassportModule,
    UserModule,
    JwtModule.registerAsync({
      useFactory: (
        config: ConfigType<typeof jwtConfig>,
      ) => ({
        secret: config.secret,
        signOptions: {
          expiresIn: config.expiresIn as SignOptions['expiresIn'],
        },
      }),
      imports: [ConfigModule],
      inject: [jwtConfig.KEY],
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
