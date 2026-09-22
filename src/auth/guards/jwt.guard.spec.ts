import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from '../auth.controller';
import { CampaignController } from '../../campaign/campaign.controller';
import { HealthController } from '../../health/health.controller';
import { UserController } from '../../user/user.controller';
import { JwtAuthGuard } from './jwt.guard';

type GuardParent = {
  canActivate: (context: ExecutionContext) => boolean;
};

const createContext = (
  controller: object,
  handler: (...args: never[]) => unknown,
): ExecutionContext =>
  ({
    getClass: () => controller.constructor,
    getHandler: () => handler,
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let parentCanActivate: jest.SpyInstance;

  beforeEach(() => {
    guard = new JwtAuthGuard(new Reflector());
    const parent = Object.getPrototypeOf(
      JwtAuthGuard.prototype,
    ) as GuardParent;
    parentCanActivate = jest
      .spyOn(parent, 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    parentCanActivate.mockRestore();
  });

  it.each([
    [HealthController.prototype, HealthController.prototype.check],
    [AuthController.prototype, AuthController.prototype.login],
    [AuthController.prototype, AuthController.prototype.refresh],
  ])('bypasses Passport JWT validation for public endpoints', (controller, handler) => {
    expect(guard.canActivate(createContext(controller, handler))).toBe(true);
    expect(parentCanActivate).not.toHaveBeenCalled();
  });

  it.each([
    [AuthController.prototype, AuthController.prototype.getProfile],
    [UserController.prototype, UserController.prototype.findAll],
    [CampaignController.prototype, CampaignController.prototype.findAll],
  ])('delegates protected endpoints to Passport JWT validation', (controller, handler) => {
    expect(guard.canActivate(createContext(controller, handler))).toBe(true);
    expect(parentCanActivate).toHaveBeenCalledTimes(1);
  });
});
