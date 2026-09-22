import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import jwtConfig from './config/jwt.config';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenDto, TokenPayloadDto } from './dto/token-payload.dto';

type SessionClient = Prisma.TransactionClient | PrismaService;
type AuthenticatedUser = Pick<TokenPayloadDto, 'userId' | 'username'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtTokenConfig: ConfigType<typeof jwtConfig>,
  ) {}

  async register(registerDto: RegisterDto): Promise<TokenDto> {
    const user = await this.userService.create(registerDto);

    return this.createSessionTokens({
      userId: user.userId,
      username: user.email,
    });
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.userService.findByEmail(email);

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return null;
    }

    return {
      userId: user.userId,
      username: user.email,
    };
  }

  async login(user: AuthenticatedUser): Promise<TokenDto> {
    return this.createSessionTokens(user);
  }

  async validateRefreshSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<TokenPayloadDto> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { is: { isDeleted: false } },
      },
      include: { user: true },
    });

    if (!session || !(await argon2.verify(session.refreshTokenHash, refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      userId: session.userId,
      username: session.user.email,
      sessionId: session.sessionId,
    };
  }

  async rotateRefreshSession(user: TokenPayloadDto): Promise<TokenDto> {
    if (!user.sessionId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: {
          sessionId: user.sessionId,
          userId: user.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.createSessionTokens(user, transaction);
    });
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const decoded = this.jwtService.decode(refreshToken) as JwtPayload | null;
    const sessionId = typeof decoded?.sid === 'string' ? decoded.sid : undefined;

    if (!sessionId) {
      return;
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        sessionId,
        userId,
        revokedAt: null,
      },
    });

    if (session && (await argon2.verify(session.refreshTokenHash, refreshToken))) {
      await this.prisma.authSession.update({
        where: { sessionId: session.sessionId },
        data: { revokedAt: new Date() },
      });
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userService.findById(userId);

    if (!user || !(await argon2.verify(user.passwordHash, changePasswordDto.currentPassword))) {
      throw new UnauthorizedException('Invalid current password');
    }

    const passwordHash = await argon2.hash(changePasswordDto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { userId },
        data: { passwordHash },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async getProfile(userId: string) {
    const user = await this.userService.findPublicById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async createSessionTokens(
    user: AuthenticatedUser,
    client: SessionClient = this.prisma,
  ): Promise<TokenDto> {
    const sessionId = randomUUID();
    const payload = { username: user.username, sub: user.userId, sid: sessionId };
    const refreshOptions: JwtSignOptions = {
      secret: this.jwtTokenConfig.refreshSecret,
      expiresIn: this.jwtTokenConfig.refreshExpiresIn as JwtSignOptions['expiresIn'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, refreshOptions),
    ]);
    const refreshPayload = this.jwtService.decode(refreshToken) as JwtPayload | null;

    if (!refreshPayload?.exp) {
      throw new Error('Refresh token has no expiration');
    }

    const refreshExpiresAt = new Date(refreshPayload.exp * 1_000);

    await client.authSession.create({
      data: {
        sessionId,
        userId: user.userId,
        refreshTokenHash: await argon2.hash(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
