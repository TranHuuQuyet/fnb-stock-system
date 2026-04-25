import { UserRole, UserStatus } from '@prisma/client';

import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new UsersService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets password and marks account as must change password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'staff1',
      fullName: 'Staff 1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      store: null
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.MUST_CHANGE_PASSWORD
    });

    const result = await service.resetPassword('admin-1', 'user-1', {
      temporaryPassword: 'ResetPass1'
    });

    expect(result.temporaryPassword).toBe('ResetPass1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          status: UserStatus.MUST_CHANGE_PASSWORD,
          failedLoginAttempts: 0,
          lockoutUntil: null
        })
      })
    );
  });

  it('rejects locking the currently signed-in admin account', async () => {
    await expect(service.lock('admin-1', 'admin-1')).rejects.toMatchObject({
      response: {
        code: 'AUTH_FORBIDDEN'
      },
      status: 403
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects self-lock through user status update', async () => {
    await expect(
      service.update('admin-1', 'admin-1', { status: UserStatus.LOCKED })
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_FORBIDDEN'
      },
      status: 403
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('locks another user normally', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      username: 'staff1',
      fullName: 'Staff 1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      store: null
    });
    prisma.user.update.mockResolvedValue({
      id: 'staff-1',
      username: 'staff1',
      fullName: 'Staff 1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hash',
      status: UserStatus.LOCKED,
      store: null
    });

    const result = await service.lock('admin-1', 'staff-1');

    expect(result.status).toBe(UserStatus.LOCKED);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-1' },
        data: expect.objectContaining({
          status: UserStatus.LOCKED,
          sessionVersion: {
            increment: 1
          }
        })
      })
    );
  });
});
