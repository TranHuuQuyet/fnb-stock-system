import { HttpStatus, Injectable } from '@nestjs/common';
import { BatchStatus, Prisma, UserRole } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { QueryBatchesDto } from './dto/query-batches.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

const batchInclude = {
  ingredient: true,
  store: true
} satisfies Prisma.IngredientBatchInclude;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  generateQrCodeValue(batchCode: string) {
    return `FNBBATCH:${batchCode}`;
  }

  async create(actorUserId: string, dto: CreateBatchDto) {
    const [ingredient, store] = await Promise.all([
      this.prisma.ingredient.findUnique({ where: { id: dto.ingredientId } }),
      this.prisma.store.findUnique({ where: { id: dto.storeId } })
    ]);

    if (!ingredient) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_INGREDIENT_NOT_FOUND,
        'Ingredient not found'
      );
    }
    if (!store) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Store not found'
      );
    }

    const batch = await this.prisma.ingredientBatch.create({
      data: {
        ingredientId: dto.ingredientId,
        storeId: dto.storeId,
        batchCode: dto.batchCode,
        receivedAt: new Date(dto.receivedAt),
        expiredAt: dto.expiredAt ? new Date(dto.expiredAt) : null,
        initialQty: dto.initialQty,
        remainingQty: dto.initialQty,
        status: dto.status ?? BatchStatus.ACTIVE,
        qrCodeValue: this.generateQrCodeValue(dto.batchCode),
        qrGeneratedAt: new Date()
      },
      include: batchInclude
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_BATCH',
      entityType: 'IngredientBatch',
      entityId: batch.id,
      newData: batch
    });

    return batch;
  }

  async listAdmin(query: QueryBatchesDto) {
    return this.list(query, query.storeId);
  }

  async listAccessible(currentUser: JwtUser, query: QueryBatchesDto) {
    const storeId =
      currentUser.role === UserRole.ADMIN ? query.storeId : currentUser.storeId ?? undefined;
    return this.list(query, storeId);
  }

  async getById(id: string) {
    const batch = await this.prisma.ingredientBatch.findUnique({
      where: { id },
      include: batchInclude
    });

    if (!batch) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_BATCH_NOT_FOUND,
        'Batch not found'
      );
    }

    return batch;
  }

  async update(actorUserId: string, id: string, dto: UpdateBatchDto) {
    const existing = await this.getById(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.ingredientBatch.update({
        where: { id },
        data: {
          ...(dto.receivedAt ? { receivedAt: new Date(dto.receivedAt) } : {}),
          ...(dto.expiredAt !== undefined
            ? { expiredAt: dto.expiredAt ? new Date(dto.expiredAt) : null }
            : {}),
          ...(dto.remainingQty !== undefined ? { remainingQty: dto.remainingQty } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.softLockReason !== undefined
            ? { softLockReason: dto.softLockReason }
            : {})
        },
        include: batchInclude
      });
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_BATCH',
      entityType: 'IngredientBatch',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async softLock(actorUserId: string, id: string, reason: string) {
    const existing = await this.getById(id);
    const updated = await this.prisma.ingredientBatch.update({
      where: { id },
      data: {
        status: BatchStatus.SOFT_LOCKED,
        softLockReason: reason
      },
      include: batchInclude
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'SOFT_LOCK_BATCH',
      entityType: 'IngredientBatch',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async unlock(actorUserId: string, id: string) {
    const existing = await this.getById(id);
    const updated = await this.prisma.ingredientBatch.update({
      where: { id },
      data: {
        status: existing.remainingQty <= 0 ? BatchStatus.DEPLETED : BatchStatus.ACTIVE,
        softLockReason: null
      },
      include: batchInclude
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UNLOCK_BATCH',
      entityType: 'IngredientBatch',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async findByBatchCode(storeId: string, batchCode: string) {
    return this.prisma.ingredientBatch.findUnique({
      where: {
        storeId_batchCode: {
          storeId,
          batchCode
        }
      },
      include: batchInclude
    });
  }

  async findOlderActiveBatch(batch: { ingredientId: string; storeId: string; receivedAt: Date; id: string }) {
    return this.prisma.ingredientBatch.findFirst({
      where: {
        ingredientId: batch.ingredientId,
        storeId: batch.storeId,
        status: BatchStatus.ACTIVE,
        remainingQty: {
          gt: 0
        },
        receivedAt: {
          lt: batch.receivedAt
        },
        id: {
          not: batch.id
        },
        OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }]
      },
      orderBy: {
        receivedAt: 'asc'
      }
    });
  }

  private async list(query: QueryBatchesDto, storeId?: string) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.IngredientBatchWhereInput = {
      ...(storeId ? { storeId } : {}),
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                batchCode: {
                  contains: query.keyword,
                  mode: 'insensitive'
                }
              },
              {
                ingredient: {
                  name: {
                    contains: query.keyword,
                    mode: 'insensitive'
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingredientBatch.findMany({
        where,
        include: batchInclude,
        skip,
        take,
        orderBy: {
          [query.sortBy ?? 'receivedAt']: query.sortOrder
        }
      }),
      this.prisma.ingredientBatch.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }
}
