import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'password', writeOnly: true })
  @IsString()
  password!: string;

  @ApiPropertyOptional({ example: 'Alex Nilsson' })
  @IsOptional()
  @IsString()
  name?: string;
}
