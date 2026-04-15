import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus, WorkEntryType, WorkScheduleStatus } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueryWorkScheduleDto } from './dto/query-work-schedule.dto';
import { SaveWorkScheduleDto } from './dto/save-work-schedule.dto';

type StoreSummary = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

type ShiftView = {
  key: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  sortOrder: number;
};

type EntryView = {
  day: number;
  shiftKey: string;
  entryType: WorkEntryType;
};

const buildDefaultShiftDefinitions = (): ShiftView[] => [
  {
    key: 'ca-1',
    code: 'CA1',
    name: 'Ca 1',
    startTime: '08:00',
    endTime: '13:00',
    durationHours: 5,
    sortOrder: 0
  },
  {
    key: 'ca-2',
    code: 'CA2',
    name: 'Ca 2',
    startTime: '13:00',
    endTime: '18:00',
    durationHours: 5,
    sortOrder: 1
  },
  {
    key: 'ca-3',
    code: 'CA3',
    name: 'Ca 3',
    startTime: '18:00',
    endTime: '24:00',
    durationHours: 6.5,
    sortOrder: 2
  }
];

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const buildWeekendDays = (year: number, month: number, totalDays: number) => {
  const weekendDays: number[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    if (new Date(year, month - 1, day).getDay() === 0) {
      weekendDays.push(day);
    }
  }
  return weekendDays;
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

@Injectable()
export class WorkSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getSchedule(currentUser: JwtUser, query: QueryWorkScheduleDto) {
    const store = await this.resolveScopedStore(currentUser, query.storeId);
    const totalDays = daysInMonth(query.year, query.month);

    const [schedule, currentUsers] = await Promise.all([
      this.prisma.workSchedule.findUnique({
        where: {
          storeId_year_month: {
            storeId: store.id,
            year: query.year,
            month: query.month
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
                  id: true,
                  username: true,
                  fullName: true,
                  role: true,
                  status: true
                }
              },
              entries: {
                orderBy: [{ day: 'asc' }, { createdAt: 'asc' }]
              }
            }
          }
        }
      }),
      this.prisma.user.findMany({
        where: {
          storeId: store.id,
          role: {
            in: [UserRole.MANAGER, UserRole.STAFF]
          },
          status: {
            not: UserStatus.INACTIVE
          }
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          status: true
        },
        orderBy: [{ fullName: 'asc' }, { username: 'asc' }]
      })
    ]);

    const shifts =
      schedule && schedule.shifts.length > 0
        ? schedule.shifts.map((shift) => ({
            key: shift.key,
            code: shift.code,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            durationHours: shift.durationHours,
            sortOrder: shift.sortOrder
          }))
        : buildDefaultShiftDefinitions();

    const shiftKeyById = new Map(
      (schedule?.shifts ?? []).map((shift) => [shift.id, shift.key] as const)
    );

    const scheduledUserIds = new Set((schedule?.employees ?? []).map((row) => row.userId));

    const employees = [
      ...(schedule?.employees ?? []).map((row) =>
        this.buildEmployeeView({
          userId: row.userId,
          displayName: row.displayName || row.user?.fullName || 'Nhân viên',
          username: row.user?.username ?? '',
          role: row.user?.role ?? UserRole.STAFF,
          sortOrder: row.sortOrder,
          trialHourlyRate: row.trialHourlyRate,
          officialHourlyRate: row.officialHourlyRate,
          allowanceAmount: row.allowanceAmount,
          lateMinutes: row.lateMinutes,
          earlyLeaveMinutes: row.earlyLeaveMinutes,
          entries: row.entries
            .map((entry) => ({
              day: entry.day,
              shiftKey: shiftKeyById.get(entry.shiftId) ?? '',
              entryType: entry.entryType
            }))
            .filter((entry) => entry.shiftKey && entry.day >= 1 && entry.day <= totalDays),
          shifts
        })
      ),
      ...currentUsers
        .filter((user) => !scheduledUserIds.has(user.id))
        .map((user, index) =>
          this.buildEmployeeView({
            userId: user.id,
            displayName: user.fullName,
            username: user.username,
            role: user.role,
            sortOrder: (schedule?.employees.length ?? 0) + index,
            trialHourlyRate: 0,
            officialHourlyRate: 0,
            allowanceAmount: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            entries: [],
            shifts
          })
        )
    ].sort((left, right) => left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName));

    return {
      store: {
        id: store.id,
        code: store.code,
        name: store.name
      },
      year: query.year,
      month: query.month,
      daysInMonth: totalDays,
      weekendDays: buildWeekendDays(query.year, query.month, totalDays),
      canEdit: currentUser.role === UserRole.ADMIN,
      schedule: {
        id: schedule?.id ?? null,
        title: schedule?.title ?? this.buildDefaultTitle(store, query.month, query.year),
        notes: schedule?.notes ?? 'T: Thử việc\nC: Chính thức',
        status: schedule?.status ?? WorkScheduleStatus.DRAFT,
        shifts,
        employees
      }
    };
  }

  async saveSchedule(currentUser: JwtUser, dto: SaveWorkScheduleDto) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Bạn không có quyền cập nhật bảng chấm công'
      );
    }

    const store = await this.resolveScopedStore(currentUser, dto.storeId);
    const totalDays = daysInMonth(dto.year, dto.month);

    if (dto.shifts.length === 0) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Bảng chấm công phải có ít nhất một ca làm việc'
      );
    }

    const normalizedShifts = dto.shifts.map((shift, index) => ({
      key: normalizeText(shift.key),
      code: normalizeText(shift.code),
      name: normalizeText(shift.name),
      startTime: shift.startTime,
      endTime: shift.endTime,
      durationHours: shift.durationHours,
      sortOrder: shift.sortOrder ?? index
    }));

    const shiftKeySet = new Set<string>();
    for (const shift of normalizedShifts) {
      if (shiftKeySet.has(shift.key)) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          'Danh sách ca làm có key bị trùng lặp'
        );
      }
      shiftKeySet.add(shift.key);
    }

    const normalizedEmployees = dto.employees.map((employee, index) => ({
      userId: employee.userId,
      sortOrder: employee.sortOrder ?? index,
      trialHourlyRate: employee.trialHourlyRate,
      officialHourlyRate: employee.officialHourlyRate,
      allowanceAmount: employee.allowanceAmount ?? 0,
      lateMinutes: employee.lateMinutes ?? 0,
      earlyLeaveMinutes: employee.earlyLeaveMinutes ?? 0,
      entries: employee.entries.map((entry) => ({
        day: entry.day,
        shiftKey: normalizeText(entry.shiftKey),
        entryType: entry.entryType
      }))
    }));

    const uniqueUserIds = [...new Set(normalizedEmployees.map((employee) => employee.userId))];
    if (uniqueUserIds.length !== normalizedEmployees.length) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Danh sách nhân viên trong bảng chấm công bị trùng lặp'
      );
    }

    const storeUsers = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        storeId: store.id,
        role: {
          in: [UserRole.MANAGER, UserRole.STAFF]
        }
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true
      }
    });

    if (storeUsers.length !== uniqueUserIds.length) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Có nhân viên không thuộc chi nhánh đã chọn'
      );
    }

    const userById = new Map(storeUsers.map((user) => [user.id, user]));
    for (const employee of normalizedEmployees) {
      const seenEntries = new Set<string>();
      for (const entry of employee.entries) {
        if (!shiftKeySet.has(entry.shiftKey)) {
          throw appException(
            HttpStatus.BAD_REQUEST,
            ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
            'Có ô phân ca đang tham chiếu đến ca không tồn tại'
          );
        }

        if (entry.day < 1 || entry.day > totalDays) {
          throw appException(
            HttpStatus.BAD_REQUEST,
            ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
            'Ngày chấm công không hợp lệ với tháng đã chọn'
          );
        }

        const uniqueEntryKey = `${entry.day}-${entry.shiftKey}`;
        if (seenEntries.has(uniqueEntryKey)) {
          throw appException(
            HttpStatus.BAD_REQUEST,
            ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
            'Một nhân viên đang bị trùng ở cùng ngày và cùng ca'
          );
        }

        seenEntries.add(uniqueEntryKey);
      }
    }

    const existing = await this.prisma.workSchedule.findUnique({
      where: {
        storeId_year_month: {
          storeId: store.id,
          year: dto.year,
          month: dto.month
        }
      },
      include: {
        shifts: true,
        employees: {
          include: {
            entries: true
          }
        }
      }
    });

    if (existing?.status === WorkScheduleStatus.LOCKED && currentUser.role !== UserRole.ADMIN) {
      throw appException(
        HttpStatus.CONFLICT,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        'Bảng chấm công đã chốt tháng, không thể chỉnh sửa'
      );
    }

    const savedSchedule = await this.prisma.$transaction(async (tx) => {
      const schedule =
        existing
          ? await tx.workSchedule.update({
              where: { id: existing.id },
              data: {
                title: dto.title.trim(),
                notes: dto.notes?.trim() || null,
                status: dto.status ?? existing.status
              }
            })
          : await tx.workSchedule.create({
              data: {
                storeId: store.id,
                year: dto.year,
                month: dto.month,
                title: dto.title.trim(),
                notes: dto.notes?.trim() || null,
                status: dto.status ?? WorkScheduleStatus.DRAFT
              }
            });

      if (existing?.employees.length) {
        await tx.workScheduleEntry.deleteMany({
          where: {
            workScheduleEmployeeId: {
              in: existing.employees.map((employee) => employee.id)
            }
          }
        });
      }

      await tx.workScheduleEmployee.deleteMany({
        where: {
          workScheduleId: schedule.id
        }
      });

      await tx.workScheduleShift.deleteMany({
        where: {
          workScheduleId: schedule.id
        }
      });

      const shiftIdByKey = new Map<string, string>();
      for (const shift of normalizedShifts.sort((left, right) => left.sortOrder - right.sortOrder)) {
        const createdShift = await tx.workScheduleShift.create({
          data: {
            workScheduleId: schedule.id,
            key: shift.key,
            code: shift.code,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            durationHours: shift.durationHours,
            sortOrder: shift.sortOrder
          }
        });

        shiftIdByKey.set(shift.key, createdShift.id);
      }

      const employeeRowIdByUserId = new Map<string, string>();
      for (const employee of normalizedEmployees.sort((left, right) => left.sortOrder - right.sortOrder)) {
        const user = userById.get(employee.userId);
        if (!user) {
          throw appException(
            HttpStatus.BAD_REQUEST,
            ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
            'Không tìm thấy nhân viên để lưu bảng chấm công'
          );
        }

        const createdEmployee = await tx.workScheduleEmployee.create({
          data: {
            workScheduleId: schedule.id,
            userId: employee.userId,
            displayName: user.fullName,
            sortOrder: employee.sortOrder,
            trialHourlyRate: employee.trialHourlyRate,
            officialHourlyRate: employee.officialHourlyRate,
            allowanceAmount: employee.allowanceAmount,
            lateMinutes: employee.lateMinutes,
            earlyLeaveMinutes: employee.earlyLeaveMinutes
          }
        });

        employeeRowIdByUserId.set(employee.userId, createdEmployee.id);
      }

      const entryPayload: Prisma.WorkScheduleEntryCreateManyInput[] = normalizedEmployees.flatMap(
        (employee) =>
          employee.entries.map((entry) => ({
            workScheduleEmployeeId: employeeRowIdByUserId.get(employee.userId)!,
            shiftId: shiftIdByKey.get(entry.shiftKey)!,
            day: entry.day,
            entryType: entry.entryType
          }))
      );

      if (entryPayload.length > 0) {
        await tx.workScheduleEntry.createMany({
          data: entryPayload
        });
      }

      return schedule;
    });

    await this.auditService.createLog({
      actorUserId: currentUser.userId,
      action: existing ? 'UPDATE_WORK_SCHEDULE' : 'CREATE_WORK_SCHEDULE',
      entityType: 'WorkSchedule',
      entityId: savedSchedule.id,
      oldData: existing
        ? {
            title: existing.title,
            status: existing.status,
            shiftCount: existing.shifts.length,
            employeeCount: existing.employees.length
          }
        : null,
      newData: {
        storeId: store.id,
        title: dto.title.trim(),
        status: dto.status ?? existing?.status ?? WorkScheduleStatus.DRAFT,
        shiftCount: normalizedShifts.length,
        employeeCount: normalizedEmployees.length
      }
    });

    return this.getSchedule(currentUser, {
      storeId: store.id,
      year: dto.year,
      month: dto.month
    });
  }

  private async resolveScopedStore(currentUser: JwtUser, storeId?: string): Promise<StoreSummary> {
    const scopedStoreId =
      currentUser.role === UserRole.ADMIN
        ? storeId ?? currentUser.storeId ?? undefined
        : currentUser.storeId ?? storeId ?? undefined;

    if (!scopedStoreId || (currentUser.role !== UserRole.ADMIN && scopedStoreId !== currentUser.storeId)) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Phạm vi chi nhánh không hợp lệ'
      );
    }

    const store = await this.prisma.store.findUnique({
      where: { id: scopedStoreId },
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

  private buildEmployeeView(params: {
    userId: string;
    displayName: string;
    username: string;
    role: UserRole;
    sortOrder: number;
    trialHourlyRate: number;
    officialHourlyRate: number;
    allowanceAmount: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    entries: EntryView[];
    shifts: ShiftView[];
  }) {
    const shiftByKey = new Map(params.shifts.map((shift) => [shift.key, shift]));
    const trialHours = params.entries.reduce((total, entry) => {
      if (entry.entryType !== WorkEntryType.TRIAL) {
        return total;
      }

      return total + (shiftByKey.get(entry.shiftKey)?.durationHours ?? 0);
    }, 0);

    const officialHours = params.entries.reduce((total, entry) => {
      if (entry.entryType !== WorkEntryType.OFFICIAL) {
        return total;
      }

      return total + (shiftByKey.get(entry.shiftKey)?.durationHours ?? 0);
    }, 0);

    const workedDays = new Set(params.entries.map((entry) => entry.day));
    const grossSalary =
      trialHours * params.trialHourlyRate + officialHours * params.officialHourlyRate;
    const lateDeduction = (params.officialHourlyRate * params.lateMinutes) / 60;
    const earlyLeaveDeduction = (params.officialHourlyRate * params.earlyLeaveMinutes) / 60;
    const totalDeductions = lateDeduction + earlyLeaveDeduction;
    const netSalary = grossSalary + params.allowanceAmount - totalDeductions;

    return {
      userId: params.userId,
      displayName: params.displayName,
      username: params.username,
      role: params.role,
      sortOrder: params.sortOrder,
      trialHourlyRate: params.trialHourlyRate,
      officialHourlyRate: params.officialHourlyRate,
      allowanceAmount: params.allowanceAmount,
      lateMinutes: params.lateMinutes,
      earlyLeaveMinutes: params.earlyLeaveMinutes,
      entries: params.entries,
      totals: {
        trialHours,
        officialHours,
        totalWorkingDays: workedDays.size,
        grossSalary,
        lateDeduction,
        earlyLeaveDeduction,
        totalDeductions,
        netSalary
      }
    };
  }

  private buildDefaultTitle(store: StoreSummary, month: number, year: number) {
    return `Bảng chấm công tháng ${String(month).padStart(2, '0')}/${year} - Chi nhánh ${store.name}`;
  }
}
