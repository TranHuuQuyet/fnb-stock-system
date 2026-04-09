import { HttpStatus, Injectable } from '@nestjs/common';
import { BatchStatus, StockAdjustmentType } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(actorUserId: string, batchId: string, dto: CreateStockAdjustmentDto) {
    const batch = await this.prisma.ingredientBatch.findUnique({
      where: { id: batchId },
      include: {
        ingredient: true,
        store: true
      }
    });

    if (!batch) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_BATCH_NOT_FOUND,
        'Không tìm thấy lô hàng'
      );
    }

    if (
      dto.adjustmentType === StockAdjustmentType.DECREASE &&
      dto.quantity > batch.remainingQty
    ) {
      throw appException(
        HttpStatus.CONFLICT,
        ERROR_CODES.STOCK_ADJUSTMENT_EXCEEDS_REMAINING,
        'Adjustment exceeds remaining quantity'
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const nextQty =
        dto.adjustmentType === StockAdjustmentType.INCREASE
          ? batch.remainingQty + dto.quantity
          : batch.remainingQty - dto.quantity;

      const updatedBatch = await tx.ingredientBatch.update({
        where: { id: batchId },
        data: {
          remainingQty: nextQty,
          status:
            nextQty <= 0
              ? BatchStatus.DEPLETED
              : batch.status === BatchStatus.DEPLETED
                ? BatchStatus.ACTIVE
                : batch.status
        },
        include: {
          ingredient: true,
          store: true
        }
      });

      const adjustment = await tx.stockAdjustment.create({
        data: {
          storeId: batch.storeId,
          batchId,
          adjustmentType: dto.adjustmentType,
          quantity: dto.quantity,
          reason: dto.reason,
          createdByUserId: actorUserId
        }
      });

      return {
        updatedBatch,
        adjustment
      };
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_STOCK_ADJUSTMENT',
      entityType: 'StockAdjustment',
      entityId: result.adjustment.id,
      oldData: {
        batchId,
        remainingQty: batch.remainingQty,
        status: batch.status
      },
      newData: {
        adjustmentType: dto.adjustmentType,
        quantity: dto.quantity,
        reason: dto.reason,
        remainingQty: result.updatedBatch.remainingQty,
        status: result.updatedBatch.status
      }
    });

    return result;
  }

  async list(batchId: string) {
    const adjustments = await this.prisma.stockAdjustment.findMany({
      where: { batchId },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return adjustments;
  }
}
