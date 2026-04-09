import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { comparePassword, hashPassword } from '../../common/utils/password';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Invalid username or password'
      );
    }

    if (user.status === UserStatus.LOCKED) {
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        'Account is locked'
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        'Account is inactive'
      );
    }

    const isValidPassword = await comparePassword(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw appException(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Invalid username or password'
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
        'Confirm password does not match'
      );
    }

    const user = await this.usersService.findById(currentUser.userId);
    if (!user) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.AUTH_UNAUTHORIZED,
        'User not found'
      );
    }

    const isValidPassword = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Current password is incorrect'
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
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
}
