import { Controller, Get, Patch, Body, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  findMe(@Request() request: { user: TokenPayloadDto }) {
    return this.userService.findPublicById(request.user.userId);
  }

  @Patch('me')
  updateMe(
    @Request() request: { user: TokenPayloadDto },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(request.user.userId, updateUserDto);
  }
}
