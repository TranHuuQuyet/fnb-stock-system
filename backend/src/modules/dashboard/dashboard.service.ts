import { HttpStatus, Injectable } from '@nestjs/common';
import { ScanOperationType, ScanResultStatus, UserRole } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { businessDateInTimezone } from '../../common/utils/timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { AnomaliesService } from '../anomalies/anomalies.service';
import { PosService } from '../pos/pos.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posService: PosService,
    private readonly anomaliesService: AnomaliesService
  ) {}

  async getSummary(currentUser: JwtUser, storeId: string | undefined, businessDate: string) {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? storeId : currentUser.storeId ?? storeId;

    if (!scopedStoreId || (currentUser.role !== UserRole.ADMIN && scopedStoreId !== currentUser.storeId)) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Phạm vi cửa hàng không hợp lệ'
      );
    }

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: scopedStoreId }
    });

    const [scanLogs, fraudAttempts, alerts, reconciliation] = await Promise.all([
      this.prisma.scanLog.findMany({
        where: {
          storeId: scopedStoreId,
          operationType: ScanOperationType.STORE_USAGE
        },
        include: {
          batch: {
            include: { ingredient: true }
          },
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      }),
      this.prisma.fraudAttemptLog.findMany({
        where: {
          storeId: scopedStoreId
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }),
      this.anomaliesService.recent(currentUser, scopedStoreId),
      this.posService.getReconciliation(currentUser, scopedStoreId, businessDate)
    ]);

    const dayLogs = scanLogs.filter(
      (log) => businessDateInTimezone(log.scannedAt, store.timezone) === businessDate
    );
    const dayFraudAttempts = fraudAttempts.filter(
      (item) => businessDateInTimezone(item.createdAt, store.timezone) === businessDate
    );
    const dayAlerts = alerts.filter(
      (item) => businessDateInTimezone(item.businessDate, store.timezone) === businessDate
    );

    return {
      store: {
        id: store.id,
        code: store.code,
        name: store.name
      },
      businessDate,
      summary: {
        totalScans: dayLogs.length,
        success: dayLogs.filter((log) => log.resultStatus === ScanResultStatus.SUCCESS).length,
        warning: dayLogs.filter((log) => log.resultStatus === ScanResultStatus.WARNING).length,
        error: dayLogs.filter((log) => log.resultStatus === ScanResultStatus.ERROR).length,
        fraudAttempts: dayFraudAttempts.length,
        anomalyAlerts: dayAlerts.length
      },
      reconciliation: reconciliation.items,
      recentFraudAttempts: fraudAttempts,
      recentScanLogs: dayLogs.slice(0, 10),
      recentAlerts: alerts.slice(0, 10)
    };
  }
}
