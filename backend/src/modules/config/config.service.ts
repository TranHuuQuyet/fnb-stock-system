import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';
import { QueryWhitelistsDto } from './dto/query-whitelists.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateWhitelistDto } from './dto/update-whitelist.dto';

@Injectable()
export class ConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getConfig() {
    const config = await this.prisma.appConfig.findUnique({
      where: { id: 'default' }
    });
    if (!config) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_CONFIG_NOT_FOUND,
        'App config not found'
      );
    }

    return config;
  }

  async updateConfig(actorUserId: string, dto: UpdateConfigDto) {
    const existing = await this.getConfig();
    const updated = await this.prisma.appConfig.update({
      where: { id: 'default' },
      data: {
        ...(dto.allowFifoBypass !== undefined
          ? { allowFifoBypass: dto.allowFifoBypass }
          : {}),
        ...(dto.anomalyThreshold !== undefined
          ? { anomalyThreshold: dto.anomalyThreshold }
          : {})
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_APP_CONFIG',
      entityType: 'AppConfig',
      entityId: updated.id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async createWhitelist(actorUserId: string, dto: CreateWhitelistDto) {
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Store not found'
      );
    }

    const whitelist = await this.prisma.storeNetworkWhitelist.create({
      data: {
        storeId: dto.storeId,
        type: dto.type,
        value: dto.value,
        isActive: dto.isActive ?? true
      },
      include: {
        store: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'CREATE_NETWORK_WHITELIST',
      entityType: 'StoreNetworkWhitelist',
      entityId: whitelist.id,
      newData: whitelist
    });

    return whitelist;
  }

  async listWhitelists(query: QueryWhitelistsDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const where: Prisma.StoreNetworkWhitelistWhereInput = {
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.keyword
        ? {
            value: {
              contains: query.keyword,
              mode: 'insensitive'
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.storeNetworkWhitelist.findMany({
        where,
        include: {
          store: true
        },
        skip,
        take,
        orderBy: {
          [query.sortBy ?? 'createdAt']: query.sortOrder
        }
      }),
      this.prisma.storeNetworkWhitelist.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async updateWhitelist(actorUserId: string, id: string, dto: UpdateWhitelistDto) {
    const existing = await this.prisma.storeNetworkWhitelist.findUnique({
      where: { id },
      include: { store: true }
    });
    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Whitelist not found'
      );
    }

    const updated = await this.prisma.storeNetworkWhitelist.update({
      where: { id },
      data: {
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.value ? { value: dto.value } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: {
        store: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_NETWORK_WHITELIST',
      entityType: 'StoreNetworkWhitelist',
      entityId: id,
      oldData: existing,
      newData: updated
    });

    return updated;
  }

  async deleteWhitelist(actorUserId: string, id: string) {
    const existing = await this.prisma.storeNetworkWhitelist.findUnique({
      where: { id }
    });
    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'Whitelist not found'
      );
    }

    await this.prisma.storeNetworkWhitelist.delete({ where: { id } });
    await this.auditService.createLog({
      actorUserId,
      action: 'DELETE_NETWORK_WHITELIST',
      entityType: 'StoreNetworkWhitelist',
      entityId: id,
      oldData: existing
    });

    return {
      id
    };
  }

  async getActiveWhitelistsByStore(storeId: string) {
    return this.prisma.storeNetworkWhitelist.findMany({
      where: {
        storeId,
        isActive: true
      }
    });
  }
}
