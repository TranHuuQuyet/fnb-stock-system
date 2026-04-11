import { HttpStatus, Injectable } from '@nestjs/common';
import { NetworkWhitelistType, Prisma } from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { appException } from '../../common/utils/app-exception';
import { buildPagination, buildPaginationMeta } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';
import { QueryWhitelistsDto } from './dto/query-whitelists.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateNetworkBypassDto } from './dto/update-network-bypass.dto';
import { UpdateWhitelistDto } from './dto/update-whitelist.dto';

export type BusinessNetworkStatus = {
  storeId: string;
  ipAddress: string;
  normalizedIpAddress: string;
  hasActiveWhitelist: boolean;
  isAllowedByWhitelist: boolean;
  matchedWhitelistTypes: NetworkWhitelistType[];
  bypassEnabled: boolean;
  bypassActive: boolean;
  bypassExpiresAt: Date | null;
  bypassReason: string | null;
  canAccessBusinessOperations: boolean;
};

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
        'Không tìm thấy cấu hình hệ thống'
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
        'Không tìm thấy cửa hàng'
      );
    }

    const whitelist = await this.prisma.storeNetworkWhitelist.create({
      data: {
        storeId: dto.storeId,
        type: dto.type,
        value: this.normalizeWhitelistValue(dto.type, dto.value),
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

    const nextType = dto.type ?? existing.type;
    const normalizedValue =
      dto.value !== undefined || dto.type !== undefined
        ? this.normalizeWhitelistValue(nextType, dto.value ?? existing.value)
        : undefined;

    const updated = await this.prisma.storeNetworkWhitelist.update({
      where: { id },
      data: {
        ...(dto.type ? { type: dto.type } : {}),
        ...(normalizedValue ? { value: normalizedValue } : {}),
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

  async getBusinessNetworkStatus(
    storeId: string,
    ipAddress: string
  ): Promise<BusinessNetworkStatus> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        networkBypassEnabled: true,
        networkBypassExpiresAt: true,
        networkBypassReason: true
      }
    });

    if (!store) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'KhÃ´ng tÃ¬m tháº¥y cá»­a hÃ ng'
      );
    }

    const normalizedIpAddress = this.normalizeIpAddress(ipAddress);
    const whitelists = await this.prisma.storeNetworkWhitelist.findMany({
      where: {
        storeId,
        isActive: true,
        type: NetworkWhitelistType.IP
      },
      select: {
        value: true
      }
    });
    const normalizedWhitelistValues = whitelists.map((item) =>
      this.normalizeIpAddress(item.value)
    );
    const isAllowedByWhitelist = normalizedWhitelistValues.includes(normalizedIpAddress);
    const bypassActive = this.isBypassActive(
      store.networkBypassEnabled,
      store.networkBypassExpiresAt
    );

    return {
      storeId,
      ipAddress,
      normalizedIpAddress,
      hasActiveWhitelist: whitelists.length > 0,
      isAllowedByWhitelist,
      matchedWhitelistTypes: isAllowedByWhitelist ? [NetworkWhitelistType.IP] : [],
      bypassEnabled: store.networkBypassEnabled,
      bypassActive,
      bypassExpiresAt: store.networkBypassExpiresAt,
      bypassReason: store.networkBypassReason,
      canAccessBusinessOperations: bypassActive || isAllowedByWhitelist
    };
  }

  async listNetworkBypasses() {
    const stores = await this.prisma.store.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        networkBypassEnabled: true,
        networkBypassExpiresAt: true,
        networkBypassReason: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return {
      data: stores.map((store) => ({
        ...store,
        bypassActive: this.isBypassActive(
          store.networkBypassEnabled,
          store.networkBypassExpiresAt
        )
      }))
    };
  }

  async updateNetworkBypass(
    actorUserId: string,
    storeId: string,
    dto: UpdateNetworkBypassDto
  ) {
    const existing = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        code: true,
        name: true,
        networkBypassEnabled: true,
        networkBypassExpiresAt: true,
        networkBypassReason: true
      }
    });

    if (!existing) {
      throw appException(
        HttpStatus.NOT_FOUND,
        ERROR_CODES.ADMIN_ERROR_STORE_NOT_FOUND,
        'KhÃ´ng tÃ¬m tháº¥y cá»­a hÃ ng'
      );
    }

    const enabled = dto.enabled ?? existing.networkBypassEnabled;
    let expiresAt: Date | null = null;
    let reason: string | null = null;

    if (enabled) {
      const rawExpiresAt =
        dto.expiresAt ?? existing.networkBypassExpiresAt?.toISOString() ?? null;
      if (!rawExpiresAt) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          'Emergency bypass pháº£i cÃ³ thá»i Ä‘iá»ƒm háº¿t hiá»‡u lá»±c'
        );
      }

      expiresAt = new Date(rawExpiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw appException(
          HttpStatus.BAD_REQUEST,
          ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
          'Thá»i Ä‘iá»ƒm háº¿t hiá»‡u lá»±c pháº£i náº±m á»Ÿ tÆ°Æ¡ng lai'
        );
      }

      reason = dto.reason?.trim() || existing.networkBypassReason || null;
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        networkBypassEnabled: enabled,
        networkBypassExpiresAt: enabled ? expiresAt : null,
        networkBypassReason: enabled ? reason : null
      },
      select: {
        id: true,
        code: true,
        name: true,
        networkBypassEnabled: true,
        networkBypassExpiresAt: true,
        networkBypassReason: true
      }
    });

    await this.auditService.createLog({
      actorUserId,
      action: 'UPDATE_STORE_NETWORK_BYPASS',
      entityType: 'StoreNetworkBypass',
      entityId: storeId,
      oldData: existing,
      newData: updated
    });

    return {
      ...updated,
      bypassActive: this.isBypassActive(
        updated.networkBypassEnabled,
        updated.networkBypassExpiresAt
      )
    };
  }

  private isBypassActive(enabled: boolean, expiresAt: Date | null) {
    return Boolean(enabled && expiresAt && expiresAt > new Date());
  }

  private normalizeWhitelistValue(type: NetworkWhitelistType, value: string) {
    return type === NetworkWhitelistType.IP ? this.normalizeIpAddress(value) : value.trim();
  }

  private normalizeIpAddress(value: string | undefined) {
    if (!value) {
      return '0.0.0.0';
    }

    const normalized = value.trim().toLowerCase();
    return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  }
}
