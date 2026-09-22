export class TokenPayloadDto {
  userId!: string;
  username!: string;
  sessionId?: string;
}

export class TokenDto {
  accessToken!: string;
  refreshToken!: string;
  refreshExpiresAt!: Date;
}
