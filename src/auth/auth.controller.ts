import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import jwtConfig from './config/jwt.config';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenDto, TokenPayloadDto } from './dto/token-payload.dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local.guard';
import { RefreshJwtAuthGuard } from './guards/refresh.guard';

const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY)
    private readonly jwtTokenConfig: ConfigType<typeof jwtConfig>,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a user and start a session' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @ApiCommonErrors({ conflict: true, notFound: false, unauthorized: false })
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.register(registerDto);
    this.setRefreshCookie(response, tokens);
    return this.createLoginResponse(tokens);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and start a session' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiCommonErrors({ notFound: false })
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(
    @Request() request: { user: TokenPayloadDto },
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.login(request.user);
    this.setRefreshCookie(response, tokens);
    return this.createLoginResponse(tokens);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshJwtAuthGuard)
  @ApiOperation({
    summary: 'Rotate the refresh session and return a new access token',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiCommonErrors({ badRequest: false, notFound: false })
  @Post('refresh')
  async refresh(
    @Request() request: { user: TokenPayloadDto },
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.rotateRefreshSession(request.user);

    this.setRefreshCookie(response, tokens);
    return this.createLoginResponse(tokens);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiNoContentResponse()
  @ApiCommonErrors({ badRequest: false, notFound: false })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Request()
    request: { user: TokenPayloadDto; cookies?: Record<string, string> },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      request.user.userId,
      request.cookies?.[this.jwtTokenConfig.refreshCookieName],
    );
    response.clearCookie(
      this.jwtTokenConfig.refreshCookieName,
      this.getRefreshCookieOptions(),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiCommonErrors({ badRequest: false })
  @Get('me')
  getProfile(@Request() request: { user: TokenPayloadDto }) {
    return this.authService.getProfile(request.user.userId);
  }

  @Throttle(AUTH_THROTTLE)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password and revoke all refresh sessions' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiNoContentResponse()
  @ApiCommonErrors({ notFound: false })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Request() request: { user: TokenPayloadDto },
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(
      request.user.userId,
      changePasswordDto,
    );
  }

  private createLoginResponse(tokens: TokenDto): LoginResponseDto {
    return {
      accessToken: tokens.accessToken,
      expiresIn: this.jwtTokenConfig.expiresIn,
    };
  }

  private setRefreshCookie(response: Response, tokens: TokenDto): void {
    response.cookie(
      this.jwtTokenConfig.refreshCookieName,
      tokens.refreshToken,
      this.getRefreshCookieOptions(tokens.refreshExpiresAt),
    );
  }

  private getRefreshCookieOptions(expiresAt?: Date) {
    return {
      httpOnly: true,
      secure: this.jwtTokenConfig.refreshCookieSecure,
      sameSite: this.jwtTokenConfig.refreshCookieSameSite,
      path: '/',
      ...(expiresAt
        ? { maxAge: Math.max(expiresAt.getTime() - Date.now(), 0) }
        : {}),
    };
  }
}
