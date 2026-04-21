import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import {
  assertPasswordPolicy,
  comparePassword
} from '../../common/utils/password';

import { AuthService } from './auth.service';

jest.mock('../../common/utils/password', () => ({
  comparePassword: jest.fn().mockResolvedValue(true),
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  assertPasswordPolicy: jest.fn()
}));

describe('AuthService', () => {
  const mockedComparePassword = comparePassword as jest.Mock;
  const mockedAssertPasswordPolicy = assertPasswordPolicy as jest.Mock;
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
      findUnique: jest.fn(),
      update: jest.fn()
    },
    runInTransaction: jest.fn()
  };

  const service = new AuthService(
    usersService as never,
    new JwtService({ secret: 'test-secret' }),
    auditService as never,
    prisma as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ failedLoginAttempts: 0 });
    prisma.runInTransaction.mockImplementation(async (callback: Function) =>
      callback({
        user: {
          findUnique: prisma.user.findUnique,
          update: prisma.user.update
        }
      })
    );
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
      sessionVersion: 0,
      store: null
    });

    await expect(
      service.login(
        {
          username: 'locked',
          password: '123456'
        },
        '127.0.0.1'
      )
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_ACCOUNT_LOCKED'
      }
    });
    expect(auditService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILED',
        actorUserId: 'user-1'
      })
    );
  });

  it('logs invalid password attempts and increments lockout counters', async () => {
    usersService.findByUsername.mockResolvedValue({
      id: 'user-2',
      username: 'staff1',
      fullName: 'Staff 1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      passwordHash: 'hashed',
      status: UserStatus.ACTIVE,
      permissions: [],
      sessionVersion: 0,
      failedLoginAttempts: 3,
      lockoutUntil: null,
      store: null
    });
    prisma.user.findUnique.mockResolvedValue({ failedLoginAttempts: 3 });
    mockedComparePassword.mockResolvedValueOnce(false);

    await expect(
      service.login(
        {
          username: 'staff1',
          password: 'wrong-password'
        },
        '127.0.0.1'
      )
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_INVALID_CREDENTIALS'
      }
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({
          failedLoginAttempts: 4
        })
      })
    );
    expect(prisma.runInTransaction).toHaveBeenCalled();
    expect(auditService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_FAILED',
        actorUserId: 'user-2',
        newData: expect.objectContaining({
          reason: 'INVALID_PASSWORD'
        })
      })
    );
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
      sessionVersion: 0,
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
        status: UserStatus.MUST_CHANGE_PASSWORD,
        sessionVersion: 0
      },
      {
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1',
        confirmPassword: 'NewPass1'
      }
    );

    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(mockedAssertPasswordPolicy).toHaveBeenCalledWith('NewPass1');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('revokes the current session on logout', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    const result = await service.logout({
      userId: 'user-1',
      username: 'staff1',
      role: UserRole.STAFF,
      storeId: 'store-1',
      status: UserStatus.ACTIVE,
      sessionVersion: 0
    });

    expect(result).toEqual({ loggedOut: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        sessionVersion: {
          increment: 1
        }
      }
    });
  });
});
