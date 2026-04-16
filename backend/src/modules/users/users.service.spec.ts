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
});
