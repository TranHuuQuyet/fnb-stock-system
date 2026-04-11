import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';

import { BusinessNetworkGuard } from './business-network.guard';

describe('BusinessNetworkGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn()
  };
  const configService = {
    getBusinessNetworkStatus: jest.fn()
  };

  const guard = new BusinessNetworkGuard(
    reflector as unknown as Reflector,
    configService as never
  );

  const buildContext = (user?: {
    userId: string;
    username: string;
    role: UserRole;
    storeId: string | null;
    status: UserStatus;
  }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          ip: '127.0.0.1'
        })
      })
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips routes that are not marked as business operations', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(configService.getBusinessNetworkStatus).not.toHaveBeenCalled();
  });

  it('allows admin users without checking network policy', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(
        buildContext({
          userId: 'admin-1',
          username: 'admin',
          role: UserRole.ADMIN,
          storeId: null,
          status: UserStatus.ACTIVE
        })
      )
    ).resolves.toBe(true);

    expect(configService.getBusinessNetworkStatus).not.toHaveBeenCalled();
  });

  it('allows staff when bypass is active for the store', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    configService.getBusinessNetworkStatus.mockResolvedValue({
      canAccessBusinessOperations: true
    });

    await expect(
      guard.canActivate(
        buildContext({
          userId: 'staff-1',
          username: 'staff1',
          role: UserRole.STAFF,
          storeId: 'store-1',
          status: UserStatus.ACTIVE
        })
      )
    ).resolves.toBe(true);
  });

  it('blocks staff when the store network policy denies access', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    configService.getBusinessNetworkStatus.mockResolvedValue({
      hasActiveWhitelist: true,
      canAccessBusinessOperations: false
    });

    await expect(
      guard.canActivate(
        buildContext({
          userId: 'staff-1',
          username: 'staff1',
          role: UserRole.STAFF,
          storeId: 'store-1',
          status: UserStatus.ACTIVE
        })
      )
    ).rejects.toBeInstanceOf(HttpException);
  });
});
