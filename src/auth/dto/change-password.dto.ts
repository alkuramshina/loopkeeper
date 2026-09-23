import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
