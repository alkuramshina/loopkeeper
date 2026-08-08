import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsString()
  @IsOptional()
  @IsUrl()
  userpicUrl?: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;
}
