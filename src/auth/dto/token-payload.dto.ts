export class TokenPayloadDto {
  userId!: string;
  username!: string;
}

export class TokenDto {
  accessToken!: string;
  refreshToken!: string;
}