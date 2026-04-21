import { HttpStatus, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BatchesService } from '../batches/batches.service';

type BatchLabelEntity = {
  id: string;
  batchCode: string;
  initialQty: number;
  printedLabelCount: number;
  ingredient: { name: string; unit: string };
  store: { name: string };
  qrCodeValue: string | null;
  qrGeneratedAt: Date | null;
  labelCreatedAt?: Date | null;
  receivedAt: Date;
  expiredAt: Date | null;
};

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
        'Khong tim thay lo hang'
      );
    }

    const updated = await this.prisma.runInTransaction(async (tx) => {
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
    const batch = await this.batchesService.getById(batchId);

    await this.auditService.createLog({
      actorUserId,
      action: 'VIEW_BATCH_LABEL',
      entityType: 'IngredientBatch',
      entityId: batchId,
      newData: {
        printedLabelCount: batch.printedLabelCount
      }
    });

    return this.buildLabelResponse(batch);
  }

  async issueLabels(actorUserId: string, batchId: string, quantity: number, reason?: string) {
    const issued = await this.prisma.runInTransaction(async (tx) => {
      const batch = await tx.ingredientBatch.findUnique({
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
          'Khong tim thay lo hang'
        );
      }

      const stats = this.buildLabelStats(batch.initialQty, batch.printedLabelCount);
      const normalizedReason = reason?.trim();
      const isReprint = batch.printedLabelCount > 0;

      if (isReprint && !normalizedReason) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          'Can nhap ly do khi phat hanh them tem cho lo da tung in'
        );
      }

      if (quantity > stats.remainingLabelCount) {
        throw appException(
          HttpStatus.CONFLICT,
          ERROR_CODES.ERROR_LABEL_PRINT_LIMIT_EXCEEDED,
          'So tem yeu cau vuot qua day so con lai cua lo nay',
          {
            requestedQuantity: quantity,
            remainingLabelCount: stats.remainingLabelCount,
            nextLabelNumber: stats.nextLabelNumber
          }
        );
      }

      const labelCreatedAt = new Date();
      const qrCodeValue =
        batch.qrCodeValue ?? this.batchesService.generateQrCodeValue(batch.batchCode);
      const qrGeneratedAt = batch.qrCodeValue ? batch.qrGeneratedAt : labelCreatedAt;

      const updatedRows = await tx.ingredientBatch.updateMany({
        where: {
          id: batchId,
          printedLabelCount: batch.printedLabelCount
        },
        data: {
          qrCodeValue,
          qrGeneratedAt,
          labelCreatedAt,
          printedLabelCount: {
            increment: quantity
          }
        }
      });

      if (updatedRows.count !== 1) {
        throw appException(
          HttpStatus.CONFLICT,
          ERROR_CODES.QR_LABEL_RENDER_ERROR,
          'Lo hang vua duoc cap nhat tu phien khac. Vui long tai lai va thu lai.'
        );
      }

      const updated = await tx.ingredientBatch.findUniqueOrThrow({
        where: { id: batchId },
        include: {
          ingredient: true,
          store: true
        }
      });

      const issuedFromNumber = batch.printedLabelCount + 1;
      const issuedToNumber = issuedFromNumber + quantity - 1;

      return {
        batch: updated,
        reason: normalizedReason ?? null,
        isReprint,
        issuedFromNumber,
        issuedToNumber,
        quantity,
        labels: Array.from({ length: quantity }, (_, index) => {
          const sequenceNumber = issuedFromNumber + index;

          return {
            sequenceNumber,
            qrCodeValue: this.buildIssuedLabelQrValue(batch.id, batch.batchCode, sequenceNumber)
          };
        })
      };
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'ISSUE_BATCH_LABELS',
      entityType: 'IngredientBatch',
      entityId: batchId,
      newData: {
        issuedQuantity: issued.quantity,
        issuedFromNumber: issued.issuedFromNumber,
        issuedToNumber: issued.issuedToNumber,
        reprintReason: issued.reason,
        isReprint: issued.isReprint,
        printedLabelCount: issued.batch.printedLabelCount,
        labelCreatedAt: issued.batch.labelCreatedAt
      }
    });

    return {
      ...this.buildLabelResponse(issued.batch),
      issuedQuantity: issued.quantity,
      issuedFromNumber: issued.issuedFromNumber,
      issuedToNumber: issued.issuedToNumber,
      labels: issued.labels
    };
  }

  private buildQrResponse(batch: BatchLabelEntity) {
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

  private buildLabelResponse(batch: BatchLabelEntity) {
    const stats = this.buildLabelStats(batch.initialQty, batch.printedLabelCount);

    return {
      batchId: batch.id,
      batchCode: batch.batchCode,
      ingredientName: batch.ingredient.name,
      storeName: batch.store.name,
      unit: batch.ingredient.unit,
      initialQty: batch.initialQty,
      qrCodeValue: batch.qrCodeValue ?? this.batchesService.generateQrCodeValue(batch.batchCode),
      qrGeneratedAt: batch.qrGeneratedAt,
      labelCreatedAt: batch.labelCreatedAt ?? null,
      printedLabelCount: batch.printedLabelCount,
      maxPrintableLabels: stats.maxPrintableLabels,
      remainingLabelCount: stats.remainingLabelCount,
      nextLabelNumber: stats.nextLabelNumber,
      receivedAt: batch.receivedAt,
      expiredAt: batch.expiredAt
    };
  }

  private buildLabelStats(initialQty: number, printedLabelCount: number) {
    const maxPrintableLabels = Math.max(0, Math.floor(initialQty));
    const remainingLabelCount = Math.max(0, maxPrintableLabels - printedLabelCount);

    return {
      maxPrintableLabels,
      remainingLabelCount,
      nextLabelNumber: remainingLabelCount > 0 ? printedLabelCount + 1 : null
    };
  }

  private buildIssuedLabelQrValue(batchId: string, batchCode: string, sequenceNumber: number) {
    return `${this.batchesService.generateQrCodeValue(batchCode)}|BATCH:${batchId}|SEQ:${sequenceNumber}`;
  }
}
