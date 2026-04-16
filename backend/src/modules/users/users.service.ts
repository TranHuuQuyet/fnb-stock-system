import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { assertPasswordPolicy, hashPassword } from '../../common/utils/password';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const sanitizeUser = <T extends { passwordHash: string }>(user: T) => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const normalizePermissions = (permissions?: string[]) =>
  Array.from(new Set(permissions ?? []));

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) { }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        store: true
      }
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        store: true
      }
    });
  }

  async create(actorUserId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username }
    });
    if (existing) {
      throw appException(
        HttpStatus.CONFLICT,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Username already exists'
      );
    }

    this.assertStoreAssignment(dto.role, dto.storeId ?? null);

    if (dto.storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!store) {
        throw appException(
          HttpStatus.NOT_FOUND,
          ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
          'Không tìm thấy cửa hàng'
        );
      }
    }

    assertPasswordPolicy(dto.temporaryPassword);
    const passwordHash = await hashPassword(dto.temporaryPassword);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        fullName: dto.fullName,
        role: dto.role,
        storeId: dto.storeId ?? null,
        passwordHash,
        status: UserStatus.MUST_CHANGE_PASSWORD,
        permissions: normalizePermissions(dto.permissions)
      },
      include: {
        store: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      newData: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
        status: user.status
      }
    });

    return {
      ...sanitizeUser(user),
      temporaryPassword: dto.temporaryPassword
    };
  }

  async list(query: QueryUsersDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.keyword
        ? {
          OR: [
            {
              username: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            },
            {
              fullName: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            }
          ]
        }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          store: true
        },
        skip,
        take,
        orderBy: {
          [query.sortBy ?? 'createdAt']: query.sortOrder
        }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      data: items.map((item) => sanitizeUser(item)),
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async getById(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_USER_NOT_FOUND,
        'Không tìm thấy người dùng'
      );
    }

    return sanitizeUser(user);
  }

  async update(actorUserId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.findById(id);
    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_USER_NOT_FOUND,
        'Không tìm thấy người dùng'
      );
    }

    const nextRole = dto.role ?? existing.role;
    const nextStoreId = dto.storeId !== undefined ? dto.storeId : existing.storeId;

    this.assertStoreAssignment(nextRole, nextStoreId ?? null);

    if (nextStoreId) {
      const store = await this.prisma.store.findUnique({ where: { id: nextStoreId } });
      if (!store) {
        throw appException(
          HttpStatus.NOT_FOUND,
          ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
          'Không tìm thấy cửa hàng'
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.storeId !== undefined ? { storeId: dto.storeId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.permissions !== undefined
          ? { permissions: normalizePermissions(dto.permissions) }
          : {})
      },
      include: {
        store: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      oldData: sanitizeUser(existing),
      newData: sanitizeUser(updated)
    });

    return sanitizeUser(updated);
  }

  async lock(actorUserId: string, id: string) {
    return this.updateStatus(actorUserId, id, UserStatus.LOCKED, 'LOCK_USER');
  }

  async unlock(actorUserId: string, id: string) {
    return this.updateStatus(actorUserId, id, UserStatus.ACTIVE, 'UNLOCK_USER');
  }

  async resetPassword(actorUserId: string, id: string, dto: ResetPasswordDto) {
    const user = await this.findById(id);
    if (!user) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_USER_NOT_FOUND,
        'Không tìm thấy người dùng'
      );
    }

    const temporaryPassword =
      dto.temporaryPassword ??
      this.generateTemporaryPassword();
    assertPasswordPolicy(temporaryPassword);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        status: UserStatus.MUST_CHANGE_PASSWORD,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockoutUntil: null
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'RESET_PASSWORD',
      entityType: 'User',
      entityId: id,
      oldData: sanitizeUser(user),
      newData: {
        status: UserStatus.MUST_CHANGE_PASSWORD
      }
    });

    return {
      userId: id,
      temporaryPassword
    };
  }

  private async updateStatus(
    actorUserId: string,
    id: string,
    status: UserStatus,
    action: string
  ) {
    const user = await this.findById(id);
    if (!user) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_USER_NOT_FOUND,
        'Không tìm thấy người dùng'
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        ...(status === UserStatus.ACTIVE
          ? {
              failedLoginAttempts: 0,
              lastFailedLoginAt: null,
              lockoutUntil: null
            }
          : {})
      },
      include: { store: true }
    });

    await this.auditService.createLog({
      actorUserId,
      action,
      entityType: 'User',
      entityId: id,
      oldData: sanitizeUser(user),
      newData: sanitizeUser(updated)
    });

    return sanitizeUser(updated);
  }

  private assertStoreAssignment(role: UserRole, storeId: string | null) {
    if (role !== UserRole.ADMIN && !storeId) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'MANAGER và STAFF phải được gắn chi nhánh'
      );
    }
  }

  private generateTemporaryPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const alphabet = `${upper}${lower}${digits}`;
    const pick = (characters: string) => characters[randomInt(0, characters.length)];
    const tail = Array.from({ length: 5 }, () => pick(alphabet)).join('');

    return `Tmp${pick(upper)}${pick(lower)}${pick(digits)}${tail}`;
  }
}
