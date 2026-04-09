import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { hashPassword } from '../../common/utils/password';
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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

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

    if (dto.storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!store) {
        throw appException(
          HttpStatus.NOT_FOUND,
          ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
          'Store not found'
        );
      }
    }

    const passwordHash = await hashPassword(dto.temporaryPassword);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        fullName: dto.fullName,
        role: dto.role,
        storeId: dto.storeId ?? null,
        passwordHash,
        status: UserStatus.MUST_CHANGE_PASSWORD
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
        'User not found'
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
        'User not found'
      );
    }

    if (dto.storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!store) {
        throw appException(
          HttpStatus.NOT_FOUND,
          ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
          'Store not found'
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.storeId !== undefined ? { storeId: dto.storeId } : {}),
        ...(dto.status ? { status: dto.status } : {})
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
        'User not found'
      );
    }

    const temporaryPassword =
      dto.temporaryPassword ??
      `Temp${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        status: UserStatus.MUST_CHANGE_PASSWORD
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
        'User not found'
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
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
}
