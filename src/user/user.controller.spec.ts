import { UserService } from './user.service';
import { UserController } from './user.controller';

describe('UserController', () => {
  it('is defined with a user service dependency', () => {
    const controller = new UserController({} as UserService);

    expect(controller).toBeDefined();
  });
});
