import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: unknown;
    newData?: unknown;
  }) {
    const normalize = (value: unknown) =>
      value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));

    return this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldData: normalize(params.oldData),
        newData: normalize(params.newData)
      }
    });
  }

  async list(query: QueryAuditLogsDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
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
          [query.sortBy ?? 'createdAt']: query.sortOrder
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }
}
