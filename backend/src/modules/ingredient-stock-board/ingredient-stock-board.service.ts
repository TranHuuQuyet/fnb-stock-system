import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  ScanOperationType,
  ScanResultStatus,
  UserRole
} from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { businessDateInTimezone } from '../../common/utils/timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueryIngredientStockBoardDto } from './dto/query-ingredient-stock-board.dto';
import { SaveIngredientStockLayoutDto } from './dto/save-ingredient-stock-layout.dto';

type StoreSummary = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

type BoardShift = {
  key: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

const LOW_STOCK_THRESHOLD = 2;

const DEFAULT_SHIFTS: BoardShift[] = [
  { key: 'ca-1', code: 'C1', name: 'Ca 1', startTime: '08:00', endTime: '13:00', sortOrder: 0 },
  { key: 'ca-2', code: 'C2', name: 'Ca 2', startTime: '13:00', endTime: '18:00', sortOrder: 1 },
  { key: 'ca-3', code: 'C3', name: 'Ca 3', startTime: '18:00', endTime: '24:00', sortOrder: 2 }
];

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const parseTimeToMinutes = (value: string) => {
  if (value === '24:00') {
    return 24 * 60;
  }

  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const buildRangeWindow = (year: number, month: number) => ({
  start: new Date(Date.UTC(year, month - 1, 1) - 36 * 60 * 60 * 1000),
  end: new Date(Date.UTC(year, month, 1) + 36 * 60 * 60 * 1000)
});

@Injectable()
export class IngredientStockBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getBoard(currentUser: JwtUser, query: QueryIngredientStockBoardDto) {
    const store = await this.resolveScopedStore(currentUser, query.storeId);
    const totalDays = daysInMonth(query.year, query.month);
    const monthPrefix = `${query.year}-${String(query.month).padStart(2, '0')}`;
    const shifts = await this.resolveBoardShifts(store.id, query.year, query.month);
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: store.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const rangeWindow = buildRangeWindow(query.year, query.month);

    const [layout, logs, batches, groups, ingredients] = await this.prisma.$transaction([
      this.prisma.ingredientStockLayout.findUnique({
        where: {
          storeId_operationType: {
            storeId: store.id,
            operationType: query.operationType
          }
        },
        include: {
          groups: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
              group: true,
              items: {
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: {
                  ingredient: {
                    include: {
                      group: true
                    }
                  }
                }
              }
            }
          }
        }
      }),
      this.prisma.scanLog.findMany({
        where: {
          storeId: store.id,
          operationType: query.operationType,
          resultStatus: {
            in: [ScanResultStatus.SUCCESS, ScanResultStatus.WARNING]
          },
          scannedAt: {
            gte: rangeWindow.start,
            lt: rangeWindow.end
          }
        },
        select: {
          quantityUsed: true,
          scannedAt: true,
          batch: {
            select: {
              ingredientId: true
            }
          }
        }
      }),
      this.prisma.ingredientBatch.findMany({
        where: {
          storeId: store.id,
          remainingQty: {
            gt: 0
          },
          status: {
            in: ['ACTIVE', 'SOFT_LOCKED']
          }
        },
        select: {
          ingredientId: true,
          remainingQty: true
        }
      }),
      this.prisma.ingredientGroup.findMany({
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.ingredient.findMany({
        include: {
          group: true
        },
        orderBy: [{ name: 'asc' }, { code: 'asc' }]
      })
    ]);

    const totalRemainingByIngredient = new Map<string, number>();
    for (const batch of batches) {
      totalRemainingByIngredient.set(
        batch.ingredientId,
        (totalRemainingByIngredient.get(batch.ingredientId) ?? 0) + batch.remainingQty
      );
    }

    const cellTotals = new Map<string, number>();
    for (const log of logs) {
      const ingredientId = log.batch?.ingredientId;
      if (!ingredientId) {
        continue;
      }

      const businessDate = businessDateInTimezone(log.scannedAt, store.timezone);
      if (!businessDate.startsWith(monthPrefix)) {
        continue;
      }

      const day = Number(businessDate.slice(-2));
      if (day < 1 || day > totalDays) {
        continue;
      }

      const timeValue = timeFormatter.format(log.scannedAt);
      const shiftKey = this.resolveShiftKey(timeValue, shifts);
      const cellKey = this.buildCellKey(ingredientId, day, shiftKey);
      cellTotals.set(cellKey, (cellTotals.get(cellKey) ?? 0) + log.quantityUsed);
    }

    const layoutGroups = layout
      ? this.buildSavedLayoutGroups(layout.groups, totalRemainingByIngredient, cellTotals, shifts)
      : this.buildDefaultLayoutGroups(
          ingredients.filter((ingredient) => ingredient.isActive),
          totalRemainingByIngredient,
          cellTotals,
          shifts
        );

    const alerts = layoutGroups
      .flatMap((group) =>
        group.items
          .filter((item) => item.totalRemainingQty < LOW_STOCK_THRESHOLD)
          .map((item) => ({
            ingredientId: item.ingredientId,
            ingredientCode: item.ingredientCode,
            ingredientName: item.ingredientName,
            unit: item.unit,
            totalRemainingQty: item.totalRemainingQty,
            groupId: group.groupId,
            groupName: group.groupName
          }))
      )
      .sort((left, right) => left.totalRemainingQty - right.totalRemainingQty || left.ingredientName.localeCompare(right.ingredientName));

    const groupUsageMap = new Map<string, number>();
    for (const ingredient of ingredients) {
      groupUsageMap.set(ingredient.groupId, (groupUsageMap.get(ingredient.groupId) ?? 0) + 1);
    }

    return {
      store,
      year: query.year,
      month: query.month,
      daysInMonth: totalDays,
      operationType: query.operationType,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      canEdit: currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER,
      shifts,
      summary: {
        groupCount: layoutGroups.length,
        ingredientCount: layoutGroups.reduce((total, group) => total + group.items.length, 0),
        lowStockCount: alerts.length
      },
      alerts,
      layout: {
        id: layout?.id ?? null,
        groups: layoutGroups
      },
      options: {
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          usageCount: groupUsageMap.get(group.id) ?? 0
        })),
        ingredients: ingredients
          .filter((ingredient) => ingredient.isActive)
          .map((ingredient) => ({
            id: ingredient.id,
            code: ingredient.code,
            name: ingredient.name,
            unit: ingredient.unit,
            isActive: ingredient.isActive,
            groupId: ingredient.groupId,
            groupName: ingredient.group.name,
            totalRemainingQty: totalRemainingByIngredient.get(ingredient.id) ?? 0
          }))
      }
    };
  }

  async saveLayout(currentUser: JwtUser, dto: SaveIngredientStockLayoutDto) {
    if (currentUser.role === UserRole.STAFF) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Nhân viên chỉ có quyền xem kho nguyên liệu'
      );
    }

    const store = await this.resolveScopedStore(currentUser, dto.storeId);
    const normalizedGroups = dto.groups.map((group, groupIndex) => ({
      groupId: group.groupId,
      sortOrder: group.sortOrder ?? groupIndex,
      items: group.items.map((item, itemIndex) => ({
        ingredientId: item.ingredientId,
        sortOrder: item.sortOrder ?? itemIndex
      }))
    }));

    const uniqueGroupIds = new Set<string>();
    const ingredientAssignments = new Map<string, string>();
    for (const group of normalizedGroups) {
      if (uniqueGroupIds.has(group.groupId)) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          'Bố cục kho nguyên liệu đang có nhóm bị trùng lặp'
        );
      }

      uniqueGroupIds.add(group.groupId);

      for (const item of group.items) {
        if (ingredientAssignments.has(item.ingredientId)) {
          throw appException(
            HttpStatus.BAD_REQUEST,
            ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
            'Một nguyên liệu chỉ được xuất hiện một lần trong bố cục kho nguyên liệu'
          );
        }

        ingredientAssignments.set(item.ingredientId, group.groupId);
      }
    }

    const groupIds = normalizedGroups.map((group) => group.groupId);
    const ingredientIds = [...ingredientAssignments.keys()];

    const [existingGroups, ingredients] = await this.prisma.$transaction([
      this.prisma.ingredientGroup.findMany({
        where: {
          id: {
            in: groupIds
          }
        }
      }),
      this.prisma.ingredient.findMany({
        where: {
          id: {
            in: ingredientIds
          }
        },
        include: {
          group: true
        }
      })
    ]);

    if (existingGroups.length !== groupIds.length) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Có nhóm nguyên liệu không tồn tại trong cấu hình kho nguyên liệu'
      );
    }

    if (ingredients.length !== ingredientIds.length) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Có nguyên liệu không tồn tại trong cấu hình kho nguyên liệu'
      );
    }

    for (const ingredient of ingredients) {
      const configuredGroupId = ingredientAssignments.get(ingredient.id);
      if (configuredGroupId && ingredient.groupId !== configuredGroupId) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          `Nguyên liệu ${ingredient.name} không thuộc nhóm đã chọn`
        );
      }
    }

    const existingLayout = await this.prisma.ingredientStockLayout.findUnique({
      where: {
        storeId_operationType: {
          storeId: store.id,
          operationType: dto.operationType
        }
      },
      include: {
        groups: {
          include: {
            items: true
          }
        }
      }
    });

    const savedLayout = await this.prisma.$transaction(async (tx) => {
      const layout =
        existingLayout ??
        (await tx.ingredientStockLayout.create({
          data: {
            storeId: store.id,
            operationType: dto.operationType
          }
        }));

      await tx.ingredientStockLayoutGroup.deleteMany({
        where: {
          layoutId: layout.id
        }
      });

      for (const group of normalizedGroups) {
        const createdGroup = await tx.ingredientStockLayoutGroup.create({
          data: {
            layoutId: layout.id,
            groupId: group.groupId,
            sortOrder: group.sortOrder
          }
        });

        if (group.items.length > 0) {
          await tx.ingredientStockLayoutItem.createMany({
            data: group.items.map((item) => ({
              layoutGroupId: createdGroup.id,
              ingredientId: item.ingredientId,
              sortOrder: item.sortOrder
            }))
          });
        }
      }

      return layout;
    });

    await this.auditService.createLog({
      actorUserId: currentUser.userId,
      action: existingLayout ? 'UPDATE_INGREDIENT_STOCK_LAYOUT' : 'CREATE_INGREDIENT_STOCK_LAYOUT',
      entityType: 'IngredientStockLayout',
      entityId: savedLayout.id,
      oldData: existingLayout,
      newData: {
        storeId: store.id,
        operationType: dto.operationType,
        groups: normalizedGroups
      }
    });

    return {
      id: savedLayout.id
    };
  }

  private async resolveScopedStore(currentUser: JwtUser, storeId?: string): Promise<StoreSummary> {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN ? storeId ?? currentUser.storeId ?? undefined : currentUser.storeId ?? undefined;

    if (!scopedStoreId || (currentUser.role !== UserRole.ADMIN && scopedStoreId !== currentUser.storeId)) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Phạm vi cửa hàng không hợp lệ'
      );
    }

    const store = await this.prisma.store.findUnique({
      where: {
        id: scopedStoreId
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

  private async resolveBoardShifts(storeId: string, year: number, month: number): Promise<BoardShift[]> {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: {
        storeId_year_month: {
          storeId,
          year,
          month
        }
      },
      select: {
        shifts: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            startTime: true,
            endTime: true
          }
        }
      }
    });

    return DEFAULT_SHIFTS.map((defaultShift, index) => ({
      ...defaultShift,
      startTime: schedule?.shifts[index]?.startTime ?? defaultShift.startTime,
      endTime: schedule?.shifts[index]?.endTime ?? defaultShift.endTime
    }));
  }

  private buildDefaultLayoutGroups(
    ingredients: Array<{
      id: string;
      code: string;
      name: string;
      unit: string;
      groupId: string;
      group: { name: string };
    }>,
    totalRemainingByIngredient: Map<string, number>,
    cellTotals: Map<string, number>,
    shifts: BoardShift[]
  ) {
    const grouped = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        items: Array<{
          ingredientId: string;
          ingredientCode: string;
          ingredientName: string;
          unit: string;
          totalRemainingQty: number;
          dailyTotals: Array<{ day: number; shiftKey: string; quantity: number }>;
        }>;
      }
    >();

    for (const ingredient of ingredients) {
      const current = grouped.get(ingredient.groupId) ?? {
        groupId: ingredient.groupId,
        groupName: ingredient.group.name,
        items: []
      };

      current.items.push(
        this.buildItemView(
          ingredient.id,
          ingredient.code,
          ingredient.name,
          ingredient.unit,
          totalRemainingByIngredient,
          cellTotals,
          shifts
        )
      );

      grouped.set(ingredient.groupId, current);
    }

    return [...grouped.values()]
      .sort((left, right) => left.groupName.localeCompare(right.groupName, 'vi'))
      .map((group, index) => ({
        groupId: group.groupId,
        groupName: group.groupName,
        sortOrder: index,
        items: group.items.sort((left, right) => left.ingredientName.localeCompare(right.ingredientName, 'vi'))
      }));
  }

  private buildSavedLayoutGroups(
    groups: Array<{
      groupId: string;
      sortOrder: number;
      group: { name: string };
      items: Array<{
        sortOrder: number;
        ingredient: {
          id: string;
          code: string;
          name: string;
          unit: string;
          groupId: string;
        };
      }>;
    }>,
    totalRemainingByIngredient: Map<string, number>,
    cellTotals: Map<string, number>,
    shifts: BoardShift[]
  ) {
    return groups.map((group) => ({
      groupId: group.groupId,
      groupName: group.group.name,
      sortOrder: group.sortOrder,
      items: group.items
        .filter((item) => item.ingredient.groupId === group.groupId)
        .map((item) =>
          this.buildItemView(
            item.ingredient.id,
            item.ingredient.code,
            item.ingredient.name,
            item.ingredient.unit,
            totalRemainingByIngredient,
            cellTotals,
            shifts
          )
        )
    }));
  }

  private buildItemView(
    ingredientId: string,
    ingredientCode: string,
    ingredientName: string,
    unit: string,
    totalRemainingByIngredient: Map<string, number>,
    cellTotals: Map<string, number>,
    shifts: BoardShift[]
  ) {
    const dailyTotals: Array<{ day: number; shiftKey: string; quantity: number }> = [];

    for (let day = 1; day <= 31; day += 1) {
      for (const shift of shifts) {
        const quantity = cellTotals.get(this.buildCellKey(ingredientId, day, shift.key));
        if (!quantity) {
          continue;
        }

        dailyTotals.push({
          day,
          shiftKey: shift.key,
          quantity
        });
      }
    }

    return {
      ingredientId,
      ingredientCode,
      ingredientName,
      unit,
      totalRemainingQty: totalRemainingByIngredient.get(ingredientId) ?? 0,
      dailyTotals
    };
  }

  private resolveShiftKey(localTime: string, shifts: BoardShift[]) {
    const currentMinutes = parseTimeToMinutes(localTime);
    const fallbackFirstShift: BoardShift = shifts[0] ?? DEFAULT_SHIFTS[0]!;
    const fallbackLastShift: BoardShift =
      shifts[shifts.length - 1] ?? DEFAULT_SHIFTS[DEFAULT_SHIFTS.length - 1]!;

    for (const shift of shifts) {
      const startMinutes = parseTimeToMinutes(shift.startTime);
      const endMinutes = parseTimeToMinutes(shift.endTime);

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return shift.key;
      }
    }

    return currentMinutes < parseTimeToMinutes(fallbackFirstShift.startTime)
      ? fallbackFirstShift.key
      : fallbackLastShift.key;
  }

  private buildCellKey(ingredientId: string, day: number, shiftKey: string) {
    return `${ingredientId}:${day}:${shiftKey}`;
  }
}
