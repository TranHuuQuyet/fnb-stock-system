import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BatchStatus,
  Prisma,
  StockTransferStatus,
  UserRole
} from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import {
  buildPagination,
  buildPaginationMeta,
  resolveSortField
} from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfirmTransferDto } from './dto/confirm-transfer.dto';
import {
  QueryTransfersDto,
  type TransferDirection
} from './dto/query-transfers.dto';

const TRANSFER_SORT_FIELDS = [
  'requestedAt',
  'confirmedAt',
  'createdAt',
  'status',
  'batchCode',
  'quantityRequested',
  'quantityReceived'
] as const;

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listTransferStores() {
    return {
      data: await this.prisma.store.findMany({
        where: {
          isActive: true
        },
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

  async list(currentUser: JwtUser, query: QueryTransfersDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const sortField = resolveSortField(query.sortBy, TRANSFER_SORT_FIELDS, 'requestedAt');
    const where = this.buildWhere(currentUser, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          ingredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true
            }
          },
          sourceStore: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          destinationStore: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          },
          confirmedByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          [sortField]: query.sortOrder
        }
      }),
      this.prisma.stockTransfer.count({ where })
    ]);

    return {
      data: items.map((item) => ({
        ...item,
        discrepancyQty:
          item.quantityReceived === null
            ? null
            : Math.max(item.quantityRequested - item.quantityReceived, 0),
        canConfirm:
          item.status === StockTransferStatus.IN_TRANSIT &&
          (currentUser.role === UserRole.ADMIN ||
            (currentUser.role === UserRole.MANAGER &&
              currentUser.storeId === item.destinationStoreId))
      })),
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async confirm(currentUser: JwtUser, id: string, dto: ConfirmTransferDto) {
    const existing = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceBatch: true,
        destinationStore: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ERROR_TRANSFER_NOT_FOUND,
        'Không tìm thấy phiếu chuyển kho'
      );
    }

    if (existing.status === StockTransferStatus.RECEIVED) {
      throw appException(
        HttpStatus.CONFLICT,
        ERROR_CODES.ERROR_TRANSFER_ALREADY_RECEIVED,
        'Phiếu chuyển kho đã được xác nhận trước đó'
      );
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.storeId !== existing.destinationStoreId
    ) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Bạn chỉ có thể xác nhận phiếu chuyển kho của chi nhánh mình'
      );
    }

    if (!existing.destinationStore.isActive) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.ERROR_TRANSFER_STORE_NOT_FOUND,
        'Chi nhánh nhận đã ngừng hoạt động, không thể xác nhận phiếu chuyển'
      );
    }

    if (dto.receivedQty > existing.quantityRequested) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.ERROR_TRANSFER_RECEIVED_QTY_INVALID,
        'Số lượng nhận không được vượt quá số lượng đã gửi'
      );
    }

    const note = dto.note?.trim() || null;
    if (dto.receivedQty < existing.quantityRequested && !note) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.ERROR_TRANSFER_CONFIRMATION_NOTE_REQUIRED,
        'Vui lòng nhập ghi chú khi số lượng nhận không khớp'
      );
    }

    const updated = await this.prisma.runInTransaction(async (tx) => {
      const freshTransfer = await tx.stockTransfer.findUnique({
        where: { id: existing.id },
        include: {
          sourceBatch: true
        }
      });

      if (!freshTransfer) {
        throw appException(
          HttpStatus.NOT_FOUND,
          ERROR_CODES.ERROR_TRANSFER_NOT_FOUND,
          'KhÃ´ng tÃ¬m tháº¥y phiáº¿u chuyá»ƒn kho'
        );
      }

      if (freshTransfer.status === StockTransferStatus.RECEIVED) {
        throw appException(
          HttpStatus.CONFLICT,
          ERROR_CODES.ERROR_TRANSFER_ALREADY_RECEIVED,
          'Phiáº¿u chuyá»ƒn kho Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n trÆ°á»›c Ä‘Ã³'
        );
      }

      const targetBatch = await tx.ingredientBatch.findUnique({
        where: {
          storeId_batchCode: {
            storeId: freshTransfer.destinationStoreId,
            batchCode: freshTransfer.batchCode
          }
        }
      });

      if (targetBatch && targetBatch.ingredientId !== freshTransfer.ingredientId) {
        throw appException(
          HttpStatus.CONFLICT,
          ERROR_CODES.ERROR_TRANSFER_BATCH_CONFLICT,
          'Chi nhánh nhận đang có lô trùng mã nhưng khác nguyên liệu'
        );
      }

      let destinationBatchId: string | null = targetBatch?.id ?? null;
      if (dto.receivedQty > 0) {
        if (targetBatch) {
          const nextTargetQty = targetBatch.remainingQty + dto.receivedQty;
          const updatedTargetBatch = await tx.ingredientBatch.update({
            where: { id: targetBatch.id },
            data: {
              initialQty: targetBatch.initialQty + dto.receivedQty,
              remainingQty: nextTargetQty,
              status:
                targetBatch.status === BatchStatus.DEPLETED && nextTargetQty > 0
                  ? BatchStatus.ACTIVE
                  : targetBatch.status
            }
          });
          destinationBatchId = updatedTargetBatch.id;
        } else {
          const createdTargetBatch = await tx.ingredientBatch.create({
            data: {
              ingredientId: freshTransfer.sourceBatch.ingredientId,
              storeId: freshTransfer.destinationStoreId,
              batchCode: freshTransfer.sourceBatch.batchCode,
              receivedAt: freshTransfer.sourceBatch.receivedAt,
              expiredAt: freshTransfer.sourceBatch.expiredAt,
              initialQty: dto.receivedQty,
              remainingQty: dto.receivedQty,
              status: BatchStatus.ACTIVE,
              softLockReason: null,
              qrCodeValue: freshTransfer.sourceBatch.qrCodeValue,
              qrGeneratedAt: freshTransfer.sourceBatch.qrGeneratedAt,
              labelCreatedAt: freshTransfer.sourceBatch.labelCreatedAt,
              printedLabelCount: 0
            }
          });
          destinationBatchId = createdTargetBatch.id;
        }
      }

      return tx.stockTransfer.update({
        where: { id: freshTransfer.id },
        data: {
          quantityReceived: dto.receivedQty,
          status: StockTransferStatus.RECEIVED,
          confirmedAt: new Date(),
          confirmedByUserId: currentUser.userId,
          confirmationNote: note,
          destinationBatchId
        },
        include: {
          ingredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true
            }
          },
          sourceStore: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          destinationStore: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          },
          confirmedByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          }
        }
      });
    }, {
      shouldRetry: (error: unknown) =>
        this.prisma.isRetryableTransactionError(error) ||
        this.prisma.isUniqueConstraintError(error, ['storeId', 'batchCode'])
    });

    await this.auditService.createLog({
      actorUserId: currentUser.userId,
      action: 'CONFIRM_STOCK_TRANSFER',
      entityType: 'StockTransfer',
      entityId: existing.id,
      oldData: {
        status: existing.status,
        quantityRequested: existing.quantityRequested,
        quantityReceived: existing.quantityReceived,
        destinationBatchId: existing.destinationBatchId
      },
      newData: {
        status: updated.status,
        quantityRequested: updated.quantityRequested,
        quantityReceived: updated.quantityReceived,
        destinationBatchId: updated.destinationBatchId,
        confirmationNote: updated.confirmationNote
      }
    });

    return {
      ...updated,
      discrepancyQty:
        updated.quantityReceived === null
          ? null
          : Math.max(updated.quantityRequested - updated.quantityReceived, 0),
      canConfirm: false
    };
  }

  private buildWhere(currentUser: JwtUser, query: QueryTransfersDto) {
    const requestedAt: Prisma.DateTimeFilter | undefined =
      query.startDate || query.endDate
        ? {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {})
          }
        : undefined;

    const baseWhere: Prisma.StockTransferWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(requestedAt ? { requestedAt } : {}),
      ...(query.batchCode
        ? {
            batchCode: {
              contains: query.batchCode,
              mode: 'insensitive'
            }
          }
        : {})
    };

    const direction = query.direction ?? 'ALL';
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? query.storeId : currentUser.storeId ?? undefined;

    if (!scopedStoreId) {
      return baseWhere;
    }

    return {
      ...baseWhere,
      ...this.buildStoreScope(scopedStoreId, direction)
    } satisfies Prisma.StockTransferWhereInput;
  }

  private buildStoreScope(storeId: string, direction: TransferDirection) {
    if (direction === 'INCOMING') {
      return {
        destinationStoreId: storeId
      };
    }

    if (direction === 'OUTGOING') {
      return {
        sourceStoreId: storeId
      };
    }

    return {
      OR: [{ sourceStoreId: storeId }, { destinationStoreId: storeId }]
    };
  }
}
