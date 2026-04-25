import { UserRole, UserStatus } from '@prisma/client';

import { comparePassword } from '../../common/utils/password';
import { UsersService } from './users.service';

jest.mock('../../common/utils/password', () => ({
  assertPasswordPolicy: jest.fn(),
  comparePassword: jest.fn().mockResolvedValue(true),
  hashPassword: jest.fn().mockResolvedValue('hashed-password')
}));

describe('UsersService', () => {
  const mockedComparePassword = comparePassword as jest.Mock;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $transaction: jest.fn()
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new UsersService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedComparePassword.mockResolvedValue(true);
    prisma.$transaction.mockImplementation((operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    );
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

  it('hides inactive users from the default list', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.list({});

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            not: UserStatus.INACTIVE
          }
        })
      })
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: {
          not: UserStatus.INACTIVE
        }
      })
    });
  });

  it('allows explicitly listing inactive users for history checks', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.list({ status: UserStatus.INACTIVE });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: UserStatus.INACTIVE
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

  it('rejects soft delete through the generic update endpoint', async () => {
    await expect(
      service.update('admin-1', 'staff-1', { status: UserStatus.INACTIVE })
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_INVALID_PAYLOAD'
      },
      status: 400
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

  it('rejects soft deleting a staff account when the admin password is wrong', async () => {
    mockedComparePassword.mockResolvedValue(false);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      username: 'admin',
      fullName: 'Admin',
      role: UserRole.ADMIN,
      storeId: null,
      passwordHash: 'admin-hash',
      status: UserStatus.ACTIVE,
      store: null
    });

    await expect(
      service.softDelete('admin-1', 'staff-1', {
        adminPassword: 'WrongPass1'
      })
    ).rejects.toMatchObject({
      response: {
        code: 'ADMIN_ERROR_INVALID_ADMIN_PASSWORD'
      },
      status: 400
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('rejects soft deleting an admin account', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        username: 'admin',
        fullName: 'Admin',
        role: UserRole.ADMIN,
        storeId: null,
        passwordHash: 'admin-hash',
        status: UserStatus.ACTIVE,
        store: null
      })
      .mockResolvedValueOnce({
        id: 'admin-2',
        username: 'admin2',
        fullName: 'Admin 2',
        role: UserRole.ADMIN,
        storeId: null,
        passwordHash: 'admin-hash-2',
        status: UserStatus.ACTIVE,
        store: null
      });

    await expect(
      service.softDelete('admin-1', 'admin-2', {
        adminPassword: 'AdminPass1'
      })
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_FORBIDDEN'
      },
      status: 403
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('soft deletes staff by disabling the account without deleting history', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        username: 'admin',
        fullName: 'Admin',
        role: UserRole.ADMIN,
        storeId: null,
        passwordHash: 'admin-hash',
        status: UserStatus.ACTIVE,
        store: null
      })
      .mockResolvedValueOnce({
        id: 'staff-1',
        username: 'staff1',
        fullName: 'Staff 1',
        role: UserRole.STAFF,
        storeId: 'store-1',
        passwordHash: 'staff-hash',
        status: UserStatus.ACTIVE,
        store: null
      });
    prisma.user.update.mockResolvedValue({
      id: 'staff-1',
      username: 'staff1',
      fullName: 'Staff 1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'staff-hash',
      status: UserStatus.INACTIVE,
      store: null
    });

    const result = await service.softDelete('admin-1', 'staff-1', {
      adminPassword: 'AdminPass1'
    });

    expect(result.status).toBe(UserStatus.INACTIVE);
    expect(mockedComparePassword).toHaveBeenCalledWith('AdminPass1', 'admin-hash');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-1' },
        data: expect.objectContaining({
          status: UserStatus.INACTIVE,
          sessionVersion: {
            increment: 1
          }
        })
      })
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(auditService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SOFT_DELETE_USER',
        entityType: 'User',
        entityId: 'staff-1'
      })
    );
  });
});
