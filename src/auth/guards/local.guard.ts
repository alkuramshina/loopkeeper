import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationException } from '../../common/exceptions/validation.exception';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const dto = plainToInstance(LoginDto, request.body);
    const errors = await validate(dto);
    if (errors.length) {
      throw new ValidationException(errors);
    }

    return (await super.canActivate(context)) as boolean;
  }
}
