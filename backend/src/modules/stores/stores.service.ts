import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(actorUserId: string, dto: CreateStoreDto) {
    const existing = await this.prisma.store.findUnique({
      where: { code: dto.code }
    });
    if (existing) {
      throw appException(
        HttpStatus.CONFLICT,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Mã cửa hàng đã tồn tại'
      );
    }

    const store = await this.prisma.store.create({
      data: {
        code: dto.code,
        name: dto.name,
        timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
        isActive: dto.isActive ?? true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_STORE',
      entityType: 'Store',
      entityId: store.id,
      newData: store
    });

    return store;
  }

  async list(query: QueryStoresDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.StoreWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: {
          [query.sortBy ?? 'createdAt']: query.sortOrder
        }
      }),
      this.prisma.store.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async listAccessible(currentUser: JwtUser) {
    const where: Prisma.StoreWhereInput = {
      isActive: true,
      ...(currentUser.role === UserRole.ADMIN
        ? {}
        : { id: currentUser.storeId ?? '__missing_store_scope__' })
    };

    return {
      data: await this.prisma.store.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          timezone: true
        },
        orderBy: [{ name: 'asc' }, { code: 'asc' }]
      })
    };
  }

  async getById(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Không tìm thấy cửa hàng'
      );
    }

    return store;
  }

  async update(actorUserId: string, id: string, dto: UpdateStoreDto) {
    const existing = await this.getById(id);

    const updated = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_STORE',
      entityType: 'Store',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }
}
