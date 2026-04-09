import { HttpStatus, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BatchesService } from '../batches/batches.service';

@Injectable()
export class BatchLabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchesService: BatchesService,
    private readonly auditService: AuditService
  ) {}

  async generateQr(actorUserId: string, batchId: string) {
    const batch = await this.batchesService.getById(batchId);
    if (!batch) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_BATCH_NOT_FOUND,
        'Không tìm thấy lô hàng'
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.ingredientBatch.update({
        where: { id: batchId },
        data: {
          qrCodeValue: this.batchesService.generateQrCodeValue(batch.batchCode),
          qrGeneratedAt: new Date()
        },
        include: {
          ingredient: true,
          store: true
        }
      });
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'GENERATE_BATCH_QR',
      entityType: 'IngredientBatch',
      entityId: batchId,
      oldData: {
        qrCodeValue: batch.qrCodeValue,
        qrGeneratedAt: batch.qrGeneratedAt
      },
      newData: {
        qrCodeValue: updated.qrCodeValue,
        qrGeneratedAt: updated.qrGeneratedAt
      }
    });

    return this.buildQrResponse(updated);
  }

  async getQr(batchId: string) {
    const batch = await this.batchesService.getById(batchId);
    return this.buildQrResponse(batch);
  }

  async getLabel(actorUserId: string, batchId: string) {
    await this.batchesService.getById(batchId);
    const batch = await this.prisma.$transaction(async (tx) => {
      return tx.ingredientBatch.update({
        where: { id: batchId },
        data: {
          labelCreatedAt: new Date()
        },
        include: {
          ingredient: true,
          store: true
        }
      });
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'VIEW_PRINT_BATCH_LABEL',
      entityType: 'IngredientBatch',
      entityId: batchId,
      newData: {
        labelCreatedAt: batch.labelCreatedAt
      }
    });

    return {
      batchId: batch.id,
      batchCode: batch.batchCode,
      ingredientName: batch.ingredient.name,
      storeName: batch.store.name,
      unit: batch.ingredient.unit,
      qrCodeValue: batch.qrCodeValue,
      qrGeneratedAt: batch.qrGeneratedAt,
      labelCreatedAt: batch.labelCreatedAt,
      receivedAt: batch.receivedAt,
      expiredAt: batch.expiredAt
    };
  }

  private buildQrResponse(batch: {
    id: string;
    batchCode: string;
    ingredient: { name: string };
    qrCodeValue: string | null;
    qrGeneratedAt: Date | null;
    labelCreatedAt?: Date | null;
    receivedAt: Date;
    expiredAt: Date | null;
  }) {
    return {
      batchId: batch.id,
      batchCode: batch.batchCode,
      ingredientName: batch.ingredient.name,
      qrCodeValue: batch.qrCodeValue,
      qrGeneratedAt: batch.qrGeneratedAt,
      labelCreatedAt: batch.labelCreatedAt ?? null,
      receivedAt: batch.receivedAt,
      expiredAt: batch.expiredAt
    };
  }
}
