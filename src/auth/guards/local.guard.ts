import { Injectable, ExecutionContext, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const dto = plainToInstance(LoginDto, req.body);
    const errors = await validate(dto);
    if (errors.length) {
      throw new BadRequestException(errors);
    }

    const result = (await super.canActivate(context)) as boolean;
    return result;
  }
}
