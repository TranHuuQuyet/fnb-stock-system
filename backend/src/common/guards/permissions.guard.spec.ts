import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn()
  };
  const prisma = {
    user: {
      findUnique: jest.fn()
    }
  };

  const guard = new PermissionsGuard(reflector as never, prisma as never);

  const createContext = (user?: {
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
          user
        })
      })
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests when no permission metadata is defined', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(
        createContext({
          userId: 'user-1',
          username: 'staff',
          role: UserRole.STAFF,
          storeId: 'store-1',
          status: UserStatus.ACTIVE
        })
      )
    ).resolves.toBe(true);
  });

  it('allows admin users without checking stored permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['view_dashboard']);

    await expect(
      guard.canActivate(
        createContext({
          userId: 'admin-1',
          username: 'admin',
          role: UserRole.ADMIN,
          storeId: null,
          status: UserStatus.ACTIVE
        })
      )
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-admin users missing a required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['view_dashboard']);
    prisma.user.findUnique.mockResolvedValue({
      permissions: ['view_scan_logs']
    });

    await expect(
      guard.canActivate(
        createContext({
          userId: 'manager-1',
          username: 'manager',
          role: UserRole.MANAGER,
          storeId: 'store-1',
          status: UserStatus.ACTIVE
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
