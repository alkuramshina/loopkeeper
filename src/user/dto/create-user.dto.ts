import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'password', minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Alex Nilsson' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
