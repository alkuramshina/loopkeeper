import {
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
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local.guard';
import { TokenPayloadDto } from './dto/token-payload.dto';
import { LoginResponseDto } from './dto/login.dto';
import { RefreshJwtAuthGuard } from './guards/refresh.guard';
import jwtConfig from './config/jwt.config';
import { type ConfigType } from '@nestjs/config';
import { type Response } from 'express'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(jwtConfig.KEY) private jwtTokenConfig: ConfigType<typeof jwtConfig>
  ) { }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(
    @Request() request,
    @Res({ passthrough: true }) response: Response
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.generateUserTokens(request.user as TokenPayloadDto);

    response.cookie(
      this.jwtTokenConfig.refreshCookieName,
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return {
      accessToken: tokens.accessToken,
      expiresIn: this.jwtTokenConfig.expiresIn,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshJwtAuthGuard)
  @Post('refresh')
  async refresh(
    @Request() request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.generateUserTokens(request.user as TokenPayloadDto);

    response.cookie(
      this.jwtTokenConfig.refreshCookieName,
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return {
      accessToken: tokens.accessToken,
      expiresIn: this.jwtTokenConfig.expiresIn,
    };
  }

  @Get('me')
  getProfile(@Request() request) {
    return request.user as TokenPayloadDto;
  }

  private getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.jwtTokenConfig.refreshCookieSecure,
      sameSite: this.jwtTokenConfig.refreshCookieSameSite,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };
  }
}
