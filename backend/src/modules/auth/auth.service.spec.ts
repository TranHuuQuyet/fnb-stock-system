import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';

import { AuthService } from './auth.service';

jest.mock('../../common/utils/password', () => ({
  comparePassword: jest.fn().mockResolvedValue(true),
  hashPassword: jest.fn().mockResolvedValue('hashed-password')
}));

describe('AuthService', () => {
  const usersService = {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    getById: jest.fn()
  };
  const auditService = {
    createLog: jest.fn()
  };
  const prisma = {
    user: {
      update: jest.fn()
    }
  };

  const service = new AuthService(
    usersService as never,
    new JwtService({ secret: 'test-secret' }),
    auditService as never,
    prisma as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects locked users on login', async () => {
    usersService.findByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'locked',
      fullName: 'Locked User',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hashed',
      status: UserStatus.LOCKED,
      store: null
    });

    await expect(
      service.login({
        username: 'locked',
        password: '123456'
      })
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_ACCOUNT_LOCKED'
      }
    });
  });

  it('changes password and activates must-change account', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      username: 'staff2',
      fullName: 'Staff 2',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hashed',
      status: UserStatus.MUST_CHANGE_PASSWORD,
      store: null
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.ACTIVE,
      store: null
    });

    const result = await service.changePassword(
      {
        userId: 'user-1',
        username: 'staff2',
        role: UserRole.STAFF,
        storeId: 'store-1',
        status: UserStatus.MUST_CHANGE_PASSWORD
      },
      {
        currentPassword: '123456',
        newPassword: '654321',
        confirmPassword: '654321'
      }
    );

    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
