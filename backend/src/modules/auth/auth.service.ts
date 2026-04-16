import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import {
  assertPasswordPolicy,
  comparePassword,
  hashPassword
} from '../../common/utils/password';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: LoginDto, ipAddress = '0.0.0.0') {
    const user = await this.usersService.findByUsername(dto.username);
    const now = new Date();

    if (!user) {
      await this.logFailedLogin(dto.username, ipAddress, 'USER_NOT_FOUND');
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Sai ten dang nhap hoac mat khau'
      );
    }

    if (user.status === UserStatus.LOCKED) {
      await this.logFailedLogin(dto.username, ipAddress, 'ACCOUNT_LOCKED', user.id);
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        'Tai khoan da bi khoa'
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.logFailedLogin(dto.username, ipAddress, 'ACCOUNT_INACTIVE', user.id);
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        'Tai khoan dang bi vo hieu hoa'
      );
    }

    if (user.lockoutUntil && user.lockoutUntil > now) {
      await this.logFailedLogin(dto.username, ipAddress, 'TOO_MANY_ATTEMPTS', user.id);
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        'Tai khoan tam thoi bi khoa do dang nhap sai nhieu lan. Vui long thu lai sau it phut.'
      );
    }

    const isValidPassword = await comparePassword(dto.password, user.passwordHash);
    if (!isValidPassword) {
      await this.registerFailedLogin(user.id);
      await this.logFailedLogin(dto.username, ipAddress, 'INVALID_PASSWORD', user.id);
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Sai ten dang nhap hoac mat khau'
      );
    }

    const tokenPayload: JwtUser = {
      userId: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId ?? null,
      status: user.status
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockoutUntil: null,
        lastLoginAt: new Date()
      }
    });

    return {
      accessToken: await this.jwtService.signAsync(tokenPayload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        store: user.store
      },
      mustChangePassword: user.status === UserStatus.MUST_CHANGE_PASSWORD
    };
  }

  async me(currentUser: JwtUser) {
    const user = await this.usersService.getById(currentUser.userId);
    return {
      ...user,
      mustChangePassword: currentUser.status === UserStatus.MUST_CHANGE_PASSWORD
    };
  }

  async logout() {
    return {
      loggedOut: true
    };
  }

  async changePassword(currentUser: JwtUser, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Mat khau xac nhan khong khop'
      );
    }

    const user = await this.usersService.findById(currentUser.userId);
    if (!user) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.AUTH_UNAUTHORIZED,
        'Khong tim thay nguoi dung'
      );
    }

    const isValidPassword = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Mat khau hien tai khong dung'
      );
    }

    assertPasswordPolicy(dto.newPassword);

    const updated = await this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockoutUntil: null,
        status:
          user.status === UserStatus.MUST_CHANGE_PASSWORD
            ? UserStatus.ACTIVE
            : user.status
      },
      include: {
        store: true
      }
    });

    await this.auditService.createLog({
      actorUserId: currentUser.userId,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: currentUser.userId,
      oldData: {
        status: user.status
      },
      newData: {
        status: updated.status
      }
    });

    return {
      id: updated.id,
      status: updated.status
    };
  }

  private async registerFailedLogin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        failedLoginAttempts: true
      }
    });
    const failedLoginAttempts = (user?.failedLoginAttempts ?? 0) + 1;
    const lockoutUntil =
      failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts,
        lastFailedLoginAt: new Date(),
        lockoutUntil
      }
    });
  }

  private async logFailedLogin(
    username: string,
    ipAddress: string,
    reason: string,
    actorUserId?: string
  ) {
    await this.auditService.createLog({
      actorUserId: actorUserId ?? null,
      action: 'LOGIN_FAILED',
      entityType: 'Auth',
      entityId: actorUserId ?? username,
      newData: {
        username,
        ipAddress,
        reason
      }
    });
  }
}
