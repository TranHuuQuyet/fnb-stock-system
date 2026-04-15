import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ScanOperationType,
  ScanResultStatus,
  StockAdjustmentType,
  UserRole,
  WorkEntryType
} from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAdminReportsDto } from './dto/query-admin-reports.dto';

type StoreSummary = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

const buildDefaultRange = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: now
  };
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminOverview(currentUser: JwtUser, query: QueryAdminReportsDto) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Bạn không có quyền xem báo cáo quản trị'
      );
    }

    const store = await this.resolveScopedStore(query.storeId);
    const range = this.resolveDateRange(query);
    const payrollYear = query.year ?? range.end.getFullYear();
    const payrollMonth = query.month ?? range.end.getMonth() + 1;

    const [inventoryBatches, adjustments, scanLogs, batches, schedule] = await Promise.all([
      this.prisma.ingredientBatch.findMany({
        where: {
          storeId: store.id,
          remainingQty: {
            gt: 0
          }
        },
        include: {
          ingredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true
            }
          }
        },
        orderBy: [{ ingredient: { name: 'asc' } }, { batchCode: 'asc' }]
      }),
      this.prisma.stockAdjustment.findMany({
        where: {
          storeId: store.id,
          adjustmentType: StockAdjustmentType.DECREASE,
          createdAt: {
            gte: range.start,
            lte: range.end
          }
        },
        include: {
          batch: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true
                }
              }
            }
          },
          createdByUser: {
            select: {
              fullName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      this.prisma.scanLog.findMany({
        where: {
          storeId: store.id,
          operationType: ScanOperationType.STORE_USAGE,
          resultStatus: {
            in: [ScanResultStatus.SUCCESS, ScanResultStatus.WARNING]
          },
          scannedAt: {
            gte: range.start,
            lte: range.end
          }
        },
        include: {
          batch: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true
                }
              }
            }
          }
        }
      }),
      this.prisma.ingredientBatch.findMany({
        where: {
          storeId: store.id,
          createdAt: {
            gte: range.start,
            lte: range.end
          }
        },
        include: {
          ingredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      }),
      this.prisma.workSchedule.findUnique({
        where: {
          storeId_year_month: {
            storeId: store.id,
            year: payrollYear,
            month: payrollMonth
          }
        },
        include: {
          shifts: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
          },
          employees: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              user: {
                select: {
                  role: true
                }
              },
              entries: {
                include: {
                  shift: {
                    select: {
                      durationHours: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    ]);

    const inventoryByIngredient = new Map<
      string,
      {
        ingredientId: string;
        ingredientCode: string;
        ingredientName: string;
        unit: string | null;
        totalRemainingQty: number;
        batchCount: number;
      }
    >();

    for (const batch of inventoryBatches) {
      const current = inventoryByIngredient.get(batch.ingredientId) ?? {
        ingredientId: batch.ingredientId,
        ingredientCode: batch.ingredient.code,
        ingredientName: batch.ingredient.name,
        unit: batch.ingredient.unit,
        totalRemainingQty: 0,
        batchCount: 0
      };

      current.totalRemainingQty += batch.remainingQty;
      current.batchCount += 1;
      inventoryByIngredient.set(batch.ingredientId, current);
    }

    const wastageByIngredient = new Map<
      string,
      {
        ingredientId: string;
        ingredientCode: string;
        ingredientName: string;
        unit: string | null;
        totalQty: number;
        adjustmentCount: number;
      }
    >();

    for (const adjustment of adjustments) {
      const ingredient = adjustment.batch.ingredient;
      const current = wastageByIngredient.get(ingredient.id) ?? {
        ingredientId: ingredient.id,
        ingredientCode: ingredient.code,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        totalQty: 0,
        adjustmentCount: 0
      };

      current.totalQty += adjustment.quantity;
      current.adjustmentCount += 1;
      wastageByIngredient.set(ingredient.id, current);
    }

    const usageByIngredient = new Map<
      string,
      {
        ingredientId: string;
        ingredientCode: string;
        ingredientName: string;
        unit: string | null;
        totalUsedQty: number;
        scanCount: number;
      }
    >();

    for (const log of scanLogs) {
      const ingredient = log.batch?.ingredient;
      if (!ingredient) {
        continue;
      }

      const current = usageByIngredient.get(ingredient.id) ?? {
        ingredientId: ingredient.id,
        ingredientCode: ingredient.code,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        totalUsedQty: 0,
        scanCount: 0
      };

      current.totalUsedQty += log.quantityUsed;
      current.scanCount += 1;
      usageByIngredient.set(ingredient.id, current);
    }

    const payrollEmployees =
      schedule?.employees.map((employee) => {
        const trialHours = employee.entries.reduce((total, entry) => {
          if (entry.entryType !== WorkEntryType.TRIAL) {
            return total;
          }

          return total + entry.shift.durationHours;
        }, 0);

        const officialHours = employee.entries.reduce((total, entry) => {
          if (entry.entryType !== WorkEntryType.OFFICIAL) {
            return total;
          }

          return total + entry.shift.durationHours;
        }, 0);

        const grossSalary =
          trialHours * employee.trialHourlyRate +
          officialHours * employee.officialHourlyRate;
        const lateDeduction = (employee.officialHourlyRate * employee.lateMinutes) / 60;
        const earlyLeaveDeduction =
          (employee.officialHourlyRate * employee.earlyLeaveMinutes) / 60;
        const totalDeductions = lateDeduction + earlyLeaveDeduction;
        const netSalary =
          grossSalary + employee.allowanceAmount - totalDeductions;

        return {
          userId: employee.userId,
          displayName: employee.displayName,
          role: employee.user.role,
          trialHours,
          officialHours,
          trialHourlyRate: employee.trialHourlyRate,
          officialHourlyRate: employee.officialHourlyRate,
          allowanceAmount: employee.allowanceAmount,
          lateMinutes: employee.lateMinutes,
          earlyLeaveMinutes: employee.earlyLeaveMinutes,
          grossSalary,
          lateDeduction,
          earlyLeaveDeduction,
          totalDeductions,
          netSalary
        };
      }) ?? [];

    const inventoryItems = [...inventoryByIngredient.values()].sort(
      (left, right) =>
        right.totalRemainingQty - left.totalRemainingQty ||
        left.ingredientName.localeCompare(right.ingredientName)
    );

    const wastageItems = [...wastageByIngredient.values()].sort(
      (left, right) =>
        right.totalQty - left.totalQty ||
        left.ingredientName.localeCompare(right.ingredientName)
    );

    const topIngredientItems = [...usageByIngredient.values()].sort(
      (left, right) =>
        right.totalUsedQty - left.totalUsedQty ||
        left.ingredientName.localeCompare(right.ingredientName)
    );

    return {
      store,
      filters: {
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        payrollYear,
        payrollMonth
      },
      summary: {
        inventoryIngredientCount: inventoryItems.length,
        inventoryTotalQty: inventoryItems.reduce(
          (total, item) => total + item.totalRemainingQty,
          0
        ),
        wastageTotalQty: wastageItems.reduce((total, item) => total + item.totalQty, 0),
        batchHistoryCount: batches.length,
        topUsageTotalQty: topIngredientItems.reduce(
          (total, item) => total + item.totalUsedQty,
          0
        ),
        payrollNetTotal: payrollEmployees.reduce(
          (total, employee) => total + employee.netSalary,
          0
        )
      },
      inventorySnapshot: {
        generatedAt: new Date().toISOString(),
        items: inventoryItems
      },
      wastage: {
        items: wastageItems,
        recentAdjustments: adjustments.map((adjustment) => ({
          id: adjustment.id,
          batchCode: adjustment.batch.batchCode,
          ingredientName: adjustment.batch.ingredient.name,
          quantity: adjustment.quantity,
          reason: adjustment.reason,
          createdAt: adjustment.createdAt,
          createdBy: adjustment.createdByUser.fullName
        }))
      },
      batchHistory: {
        items: batches.map((batch) => ({
          id: batch.id,
          batchCode: batch.batchCode,
          ingredientName: batch.ingredient.name,
          unit: batch.ingredient.unit,
          receivedAt: batch.receivedAt,
          expiredAt: batch.expiredAt,
          initialQty: batch.initialQty,
          remainingQty: batch.remainingQty,
          status: batch.status,
          printedLabelCount: batch.printedLabelCount,
          createdAt: batch.createdAt
        }))
      },
      topIngredients: {
        items: topIngredientItems
      },
      workScheduleSummary: {
        title: schedule?.title ?? null,
        status: schedule?.status ?? null,
        year: payrollYear,
        month: payrollMonth,
        employees: payrollEmployees
      }
    };
  }

  private resolveDateRange(query: QueryAdminReportsDto) {
    const defaults = buildDefaultRange();
    return {
      start: query.startDate ? new Date(query.startDate) : defaults.start,
      end: query.endDate ? new Date(query.endDate) : defaults.end
    };
  }

  private async resolveScopedStore(storeId?: string): Promise<StoreSummary> {
    if (!storeId) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_QUERY,
        'Vui lòng chọn chi nhánh để xem báo cáo'
      );
    }

    const store = await this.prisma.store.findUnique({
      where: {
        id: storeId
      },
      select: {
        id: true,
        code: true,
        name: true,
        timezone: true
      }
    });

    if (!store) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Không tìm thấy chi nhánh'
      );
    }

    return store;
  }
}
