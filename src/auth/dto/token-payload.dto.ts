export class TokenPayloadDto {
  userId!: string;
  username!: string;
  email?: string;
}

export class TokenDto {
  accessToken!: string;
  refreshToken!: string;
}