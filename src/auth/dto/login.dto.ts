import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email' })
  @IsNotEmpty()
  @IsString()
  email!: string;

  @ApiProperty({ format: 'password' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime.' })
  expiresIn!: string;
}
