import { HttpStatus, Injectable } from '@nestjs/common';
import { AlertSeverity, UserRole } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PosService } from '../pos/pos.service';

@Injectable()
export class AnomaliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posService: PosService
  ) {}

  async run(currentUser: JwtUser, storeId: string, businessDate: string) {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? storeId : currentUser.storeId ?? storeId;

    if (!scopedStoreId || (currentUser.role !== UserRole.ADMIN && scopedStoreId !== currentUser.storeId)) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Phạm vi cửa hàng không hợp lệ'
      );
    }

    const reconciliation = await this.posService.getReconciliation(
      currentUser,
      scopedStoreId,
      businessDate
    );

    const alerts = reconciliation.items.filter((item) => item.belowThreshold);

    await this.prisma.$transaction(async (tx) => {
      await tx.anomalyAlert.deleteMany({
        where: {
          storeId: scopedStoreId,
          businessDate: new Date(businessDate)
        }
      });

      if (alerts.length > 0) {
        await tx.anomalyAlert.createMany({
          data: alerts.map((item) => ({
            storeId: scopedStoreId,
            businessDate: new Date(businessDate),
            ingredientId: item.ingredientId,
            expectedQty: item.expectedQty,
            actualQty: item.actualQty,
            ratio: item.ratio,
            severity:
              item.ratio < 0.5
                ? AlertSeverity.HIGH
                : item.ratio < 0.7
                  ? AlertSeverity.MEDIUM
                  : AlertSeverity.LOW,
            message: `Mức sử dụng thực tế của ${item.ingredientName} đang thấp hơn ngưỡng cảnh báo`
          }))
        });
      }
    });

    return this.prisma.anomalyAlert.findMany({
      where: {
        storeId: scopedStoreId,
        businessDate: new Date(businessDate)
      },
      include: {
        ingredient: true
      },
      orderBy: {
        ratio: 'asc'
      }
    });
  }

  async recent(currentUser: JwtUser, storeId?: string) {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? storeId : currentUser.storeId ?? undefined;

    return this.prisma.anomalyAlert.findMany({
      where: {
        ...(scopedStoreId ? { storeId: scopedStoreId } : {})
      },
      include: {
        ingredient: true,
        store: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
  }
}
