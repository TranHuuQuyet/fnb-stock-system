import { UserRole } from '@prisma/client';

import { comparePassword } from '../../common/utils/password';
import { StoresService } from './stores.service';

jest.mock('../../common/utils/password', () => ({
  comparePassword: jest.fn().mockResolvedValue(true)
}));

describe('StoresService', () => {
  const mockedComparePassword = comparePassword as jest.Mock;
  const prisma = {
    store: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new StoresService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedComparePassword.mockResolvedValue(true);
    prisma.$transaction.mockImplementation((operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    );
  });

  it('rejects disabling a store through the generic update endpoint', async () => {
    await expect(
      service.update('admin-1', 'store-1', { isActive: false })
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_INVALID_PAYLOAD'
      },
      status: 400
    });

    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it('rejects soft deleting a store when the admin password is wrong', async () => {
    mockedComparePassword.mockResolvedValue(false);
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ADMIN,
      passwordHash: 'admin-hash'
    });

    await expect(
      service.softDelete('admin-1', 'store-1', {
        adminPassword: 'WrongPass1'
      })
    ).rejects.toMatchObject({
      response: {
        code: 'ADMIN_ERROR_INVALID_ADMIN_PASSWORD'
      },
      status: 400
    });

    expect(prisma.store.update).not.toHaveBeenCalled();
    expect(prisma.store.delete).not.toHaveBeenCalled();
  });

  it('soft deletes a store by marking it inactive and preserving related data', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ADMIN,
      passwordHash: 'admin-hash'
    });
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      code: 'S1',
      name: 'Store 1',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    });
    prisma.store.update.mockResolvedValue({
      id: 'store-1',
      code: 'S1',
      name: 'Store 1',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: false
    });

    const result = await service.softDelete('admin-1', 'store-1', {
      adminPassword: 'AdminPass1'
    });

    expect(result.isActive).toBe(false);
    expect(mockedComparePassword).toHaveBeenCalledWith('AdminPass1', 'admin-hash');
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store-1' },
      data: { isActive: false }
    });
    expect(prisma.store.delete).not.toHaveBeenCalled();
    expect(auditService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SOFT_DELETE_STORE',
        entityType: 'Store',
        entityId: 'store-1'
      })
    );
  });

  it('can still fetch inactive stores for historical views', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      code: 'S1',
      name: 'Store 1',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: false
    });

    const result = await service.getById('store-1');

    expect(result.isActive).toBe(false);
  });
});
