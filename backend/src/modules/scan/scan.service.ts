import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BatchStatus,
  FraudAttemptType,
  NetworkWhitelistType,
  Prisma,
  ScanEntryMethod,
  ScanOperationType,
  ScanResultStatus,
  ScanSource,
  StockTransferStatus,
  UserRole
} from '@prisma/client';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { PERMISSIONS } from '../../common/constants/permissions';
import type { JwtUser } from '../../common/types/request-with-user';
import { appException } from '../../common/utils/app-exception';
import {
  buildPagination,
  buildPaginationMeta,
  resolveSortField
} from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { BatchesService } from '../batches/batches.service';
import { ConfigService, type BusinessNetworkStatus } from '../config/config.service';
import { DevicesService } from '../devices/devices.service';
import { QueryScanLogsDto } from './dto/query-scan-logs.dto';
import { ScanDto } from './dto/scan.dto';
import { MAX_SYNC_SCAN_EVENTS } from './dto/sync-scan.dto';

type ProcessScanParams = {
  currentUser: JwtUser;
  dto: ScanDto;
  deviceId: string;
  ipAddress: string;
  source: ScanSource;
  entryMethod: ScanEntryMethod;
  syncMode?: boolean;
};

type ProcessScanResult = {
  duplicated: boolean;
  clientEventId: string;
  resultStatus: ScanResultStatus;
  resultCode: string;
  message: string;
  batchCode: string;
  operationType?: ScanOperationType;
  batchId?: string | null;
  destinationStoreId?: string | null;
  remainingQty?: number;
  ingredientName?: string;
  ingredientUnit?: string | null;
  scanLogId?: string;
  transferId?: string;
  transferStatus?: StockTransferStatus;
};

type ScannedLabelInfo = {
  value: string;
  batchId: string;
  sequenceNumber: number;
  consumedLabelKey: string;
};

const SCAN_LOG_SORT_FIELDS = [
  'scannedAt',
  'receivedAt',
  'createdAt',
  'resultStatus',
  'operationType',
  'quantityUsed'
] as const;

@Injectable()
export class ScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: DevicesService,
    private readonly configService: ConfigService,
    private readonly batchesService: BatchesService
  ) {}

  async scan(currentUser: JwtUser, dto: ScanDto, deviceId: string, ipAddress: string) {
    const result = await this.processScanRequest({
      currentUser,
      dto,
      deviceId,
      ipAddress,
      source: ScanSource.ONLINE,
      entryMethod: dto.entryMethod ?? ScanEntryMethod.CAMERA
    });

    if (result.resultStatus === ScanResultStatus.ERROR) {
      throw appException(HttpStatus.CONFLICT, result.resultCode, result.message, result);
    }

    return result;
  }

  async manualScan(
    currentUser: JwtUser,
    dto: ScanDto,
    deviceId: string,
    ipAddress: string
  ) {
    const result = await this.processScanRequest({
      currentUser,
      dto,
      deviceId,
      ipAddress,
      source: ScanSource.MANUAL_ENTRY,
      entryMethod: ScanEntryMethod.MANUAL
    });

    if (result.resultStatus === ScanResultStatus.ERROR) {
      throw appException(HttpStatus.CONFLICT, result.resultCode, result.message, result);
    }

    return result;
  }

  async sync(currentUser: JwtUser, events: ScanDto[], deviceId: string, ipAddress: string) {
    if (events.length > MAX_SYNC_SCAN_EVENTS) {
      throw appException(
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
        `Moi lan dong bo chi duoc gui toi da ${MAX_SYNC_SCAN_EVENTS} luot quet`
      );
    }

    const results: ProcessScanResult[] = [];

    for (const event of events) {
      results.push(
        await this.processScanRequest({
          currentUser,
          dto: event,
          deviceId: event.deviceId ?? deviceId,
          ipAddress,
          source: ScanSource.OFFLINE_SYNC,
          entryMethod: event.entryMethod ?? ScanEntryMethod.CAMERA,
          syncMode: true
        })
      );
    }

    return {
      data: results,
      synced: results.filter((item) => item.resultStatus !== ScanResultStatus.ERROR).length,
      failed: results.filter((item) => item.resultStatus === ScanResultStatus.ERROR).length
    };
  }

  async listLogs(currentUser: JwtUser, query: QueryScanLogsDto) {
    const { page, pageSize, skip, take } = buildPagination(query);
    const sortField = resolveSortField(query.sortBy, SCAN_LOG_SORT_FIELDS, 'scannedAt');
    const where = await this.buildEnhancedLogWhere(currentUser, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.scanLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          store: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          destinationStore: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          batch: {
            include: {
              ingredient: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          [sortField]: query.sortOrder
        }
      }),
      this.prisma.scanLog.count({ where })
    ]);

    return {
      data: items,
      pagination: buildPaginationMeta(page, pageSize, total)
    };
  }

  async getNetworkStatus(
    currentUser: JwtUser,
    requestedStoreId: string | undefined,
    ipAddress: string,
    ssid?: string
  ): Promise<BusinessNetworkStatus> {
    const storeId =
      currentUser.role === UserRole.ADMIN ? requestedStoreId : currentUser.storeId;

    if (!storeId) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Thiếu phạm vi cửa hàng để kiểm tra trạng thái mạng'
      );
    }

    return this.configService.getBusinessNetworkStatus(storeId, ipAddress);
  }

  private async processScan(params: ProcessScanParams): Promise<ProcessScanResult> {
    const storeId =
      params.currentUser.role === UserRole.ADMIN
        ? params.dto.storeId
        : params.currentUser.storeId;

    if (!storeId) {
      return {
        duplicated: false,
        clientEventId: params.dto.clientEventId,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: ERROR_CODES.AUTH_FORBIDDEN,
        message: 'Thiếu phạm vi cửa hàng để xử lý lượt quét',
        batchCode: params.dto.batchCode
      };
    }

    const existing = await this.prisma.scanLog.findUnique({
      where: {
        clientEventId: params.dto.clientEventId
      }
    });
    if (existing) {
      return {
        duplicated: true,
        clientEventId: existing.clientEventId,
        resultStatus: existing.resultStatus,
        resultCode: existing.resultCode,
        message: existing.message,
        batchCode: params.dto.batchCode,
        batchId: existing.batchId,
        scanLogId: existing.id
      };
    }

    try {
      await this.devicesService.upsert({
        deviceId: params.deviceId,
        storeId,
        userId: params.currentUser.userId
      });

      const config = await this.configService.getConfig();
      const batch = await this.batchesService.findByBatchCode(storeId, params.dto.batchCode);
      const validationError = await this.validateScanInput(params, batch, config.allowFifoBypass);

      if (validationError) {
        return validationError;
      }

      const processed = await this.prisma.runInTransaction(async (tx) => {
      const freshBatch = await tx.ingredientBatch.findUniqueOrThrow({
        where: {
          id: batch!.id
        }
      });

      const freshValidationError = await this.validateFreshBatchInTransaction(
        tx,
        params,
        storeId,
        freshBatch,
        ScanOperationType.STORE_USAGE
      );
      if (freshValidationError) {
        return freshValidationError;
      }

      const olderBatch = await this.batchesService.findOlderActiveBatch(freshBatch, tx);
      let resultStatus: ScanResultStatus = ScanResultStatus.SUCCESS;
      let resultCode = ERROR_CODES.SCAN_OK as string;
      let message = 'Đã ghi nhận lượt quét thành công';

      if (olderBatch) {
        if (!config.allowFifoBypass) {
          return this.createErrorLogAndResult(tx, params, {
            storeId,
            batchId: freshBatch.id,
            resultCode: ERROR_CODES.ERROR_FIFO,
            message: 'Đang còn lô cũ hơn. Hệ thống bắt buộc xuất theo FIFO.'
          });
        }

        resultStatus = ScanResultStatus.WARNING;
        resultCode = ERROR_CODES.WARNING_FIFO;
        message = 'Cảnh báo FIFO: vẫn còn lô cũ hơn chưa được sử dụng hết';
      }

      const nextQty = freshBatch.remainingQty - params.dto.quantityUsed;
      const updatedBatch = await tx.ingredientBatch.update({
        where: { id: freshBatch.id },
        data: {
          remainingQty: nextQty,
          status: nextQty <= 0 ? BatchStatus.DEPLETED : freshBatch.status
        }
      });

      const scanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: freshBatch.id,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus,
          resultCode,
          message,
          duplicated: false
        }
      });

      return {
        duplicated: false,
        clientEventId: scanLog.clientEventId,
        resultStatus,
        resultCode,
        message,
        batchCode: params.dto.batchCode,
        batchId: scanLog.batchId,
        remainingQty: updatedBatch.remainingQty,
        scanLogId: scanLog.id
      } satisfies ProcessScanResult;
      });

      return processed;
    } catch (error) {
      const duplicated = await this.resolveDuplicateClientEvent(params, error);
      if (duplicated) {
        return duplicated;
      }

      throw error;
    }
  }

  private async validateScanInput(
    params: ProcessScanParams,
    batch: Awaited<ReturnType<BatchesService['findByBatchCode']>>,
    allowFifoBypass: boolean
  ): Promise<ProcessScanResult | null> {
    const storeId =
      params.currentUser.role === UserRole.ADMIN
        ? params.dto.storeId
        : params.currentUser.storeId;

    if (params.currentUser.role !== UserRole.ADMIN) {
      const whitelists = await this.configService.getActiveWhitelistsByStore(storeId!);
      const networkValid = this.isNetworkValid(whitelists, params.ipAddress, params.dto.ssid);
      if (!networkValid) {
        return this.createNetworkRejectedResult(params, storeId!);
      }
    }

    if (!batch) {
      return this.createErrorResult(params, {
        storeId: storeId!,
        batchId: null,
        resultCode: ERROR_CODES.ERROR_BATCH_NOT_FOUND,
        message: 'Không tìm thấy lô nguyên liệu'
      });
    }

    const scannedAt = new Date(params.dto.scannedAt);
    const isExpired = batch.expiredAt ? batch.expiredAt <= scannedAt : false;
    if (isExpired || batch.status === BatchStatus.EXPIRED) {
      return this.createErrorResult(params, {
        storeId: storeId!,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_EXPIRED,
        message: 'Lô nguyên liệu đã hết hạn'
      });
    }

    if (batch.status === BatchStatus.SOFT_LOCKED) {
      return this.createErrorResult(params, {
        storeId: storeId!,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_SOFT_LOCKED,
        message: 'Lô nguyên liệu đang bị khóa mềm'
      });
    }

    if (batch.status !== BatchStatus.ACTIVE || batch.remainingQty <= 0) {
      return this.createErrorResult(params, {
        storeId: storeId!,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_DEPLETED,
        message: 'Lô nguyên liệu đã hết số lượng'
      });
    }

    if (params.dto.quantityUsed > batch.remainingQty) {
      return this.createErrorResult(params, {
        storeId: storeId!,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_INSUFFICIENT_QTY,
        message: 'Số lượng còn lại của lô không đủ'
      });
    }

    if (!allowFifoBypass) {
      const olderBatch = await this.batchesService.findOlderActiveBatch(batch);
      if (olderBatch) {
        return this.createErrorResult(params, {
          storeId: storeId!,
          batchId: batch.id,
          resultCode: ERROR_CODES.ERROR_FIFO,
          message: 'Đang còn lô cũ hơn. Hệ thống bắt buộc xuất theo FIFO.'
        });
      }
    }

    return null;
  }

  private async createNetworkRejectedResult(
    params: ProcessScanParams,
    storeId: string
  ): Promise<ProcessScanResult> {
    const detail = `IP ${params.ipAddress} không nằm trong danh sách mạng được phép`;

    return this.prisma.runInTransaction(async (tx) => {
      await tx.fraudAttemptLog.create({
        data: {
          storeId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          attemptType: FraudAttemptType.NETWORK_RESTRICTED,
          detail
        }
      });

      const scanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: null,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus: ScanResultStatus.ERROR,
          resultCode: ERROR_CODES.ERROR_NETWORK_RESTRICTED,
          message: 'Lượt quét bị từ chối vì mạng hiện tại chưa được cho phép'
        }
      });

      return {
        duplicated: false,
        clientEventId: params.dto.clientEventId,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: ERROR_CODES.ERROR_NETWORK_RESTRICTED,
        message: 'Lượt quét bị từ chối vì mạng hiện tại chưa được cho phép',
        batchCode: params.dto.batchCode,
        batchId: null,
        scanLogId: scanLog.id
      };
    });
  }

  private async createErrorResult(
    params: ProcessScanParams,
    payload: {
      storeId: string;
      batchId: string | null;
      resultCode: string;
      message: string;
    }
  ): Promise<ProcessScanResult> {
    return this.prisma.runInTransaction((tx) =>
      this.createErrorLogAndResult(tx, params, payload)
    );
  }

  private async createErrorLogAndResult(
    tx: Prisma.TransactionClient,
    params: ProcessScanParams,
    payload: {
      storeId: string;
      batchId: string | null;
      resultCode: string;
      message: string;
    }
  ): Promise<ProcessScanResult> {
    const scanLog = await tx.scanLog.create({
      data: {
        clientEventId: params.dto.clientEventId,
        storeId: payload.storeId,
        userId: params.currentUser.userId,
        deviceId: params.deviceId,
        batchId: payload.batchId,
        quantityUsed: params.dto.quantityUsed,
        scannedAt: new Date(params.dto.scannedAt),
        receivedAt: new Date(),
        source: params.source,
        entryMethod: params.entryMethod,
        ipAddress: params.ipAddress,
        ssid: params.dto.ssid,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: payload.resultCode,
        message: payload.message
      }
    });

    return {
      duplicated: false,
      clientEventId: params.dto.clientEventId,
      resultStatus: ScanResultStatus.ERROR,
      resultCode: payload.resultCode,
      message: payload.message,
      batchCode: params.dto.batchCode,
      batchId: payload.batchId,
      scanLogId: scanLog.id
    };
  }

  private isNetworkValid(
    whitelists: { type: NetworkWhitelistType; value: string }[],
    ipAddress: string,
    ssid?: string
  ) {
    return this.evaluateNetworkAccess(whitelists, ipAddress, ssid).isAllowed;
  }

  private evaluateNetworkAccess(
    whitelists: { type: NetworkWhitelistType; value: string }[],
    ipAddress: string,
    ssid?: string
  ) {
    const normalizedIpAddress = this.normalizeIpAddress(ipAddress);
    const normalizedSsid = ssid?.trim();

    if (whitelists.length === 0) {
      return {
        isAllowed: true,
        normalizedIpAddress,
        matchedWhitelistTypes: [] as NetworkWhitelistType[]
      };
    }

    const ipWhitelists = whitelists
      .filter((item) => item.type === NetworkWhitelistType.IP)
      .map((item) => this.normalizeIpAddress(item.value));
    const ssidWhitelists = whitelists
      .filter((item) => item.type === NetworkWhitelistType.SSID)
      .map((item) => item.value.trim());

    const ipMatched = ipWhitelists.includes(normalizedIpAddress);
    const ssidMatched = normalizedSsid ? ssidWhitelists.includes(normalizedSsid) : false;
    const ipValid = ipWhitelists.length === 0 || ipMatched;
    const ssidValid =
      ssidWhitelists.length === 0 || !normalizedSsid || ssidMatched;

    const matchedWhitelistTypes: NetworkWhitelistType[] = [];
    if (ipMatched) {
      matchedWhitelistTypes.push(NetworkWhitelistType.IP);
    }
    if (ssidMatched) {
      matchedWhitelistTypes.push(NetworkWhitelistType.SSID);
    }

    return {
      isAllowed: ipValid && ssidValid,
      normalizedIpAddress,
      matchedWhitelistTypes
    };
  }

  private normalizeIpAddress(value: string | undefined) {
    if (!value) {
      return '0.0.0.0';
    }

    const normalized = value.trim().toLowerCase();
    return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  }

  private async buildLogWhere(currentUser: JwtUser, query: QueryScanLogsDto) {
    const baseWhere: Prisma.ScanLogWhereInput = {
      ...(query.resultStatus ? { resultStatus: query.resultStatus } : {}),
      ...(query.batchCode
        ? {
            batch: {
              batchCode: {
                contains: query.batchCode,
                mode: 'insensitive'
              }
            }
          }
        : {})
    };

    if (currentUser.role === UserRole.ADMIN) {
      return {
        ...baseWhere,
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.userId ? { userId: query.userId } : {})
      };
    }

    if (currentUser.role === UserRole.MANAGER) {
      return {
        ...baseWhere,
        storeId: currentUser.storeId!,
        ...(query.userId ? { userId: query.userId } : {})
      };
    }

    return {
      ...baseWhere,
      storeId: currentUser.storeId!,
      userId: currentUser.userId
    };
  }

  private async processScanRequest(params: ProcessScanParams): Promise<ProcessScanResult> {
    const storeId = this.getStoreIdForScanRequest(params.currentUser, params.dto);
    const operationType = params.dto.operationType ?? ScanOperationType.STORE_USAGE;
    let batch: Awaited<ReturnType<BatchesService['findByBatchCode']>> | null = null;

    if (!storeId) {
      return {
        duplicated: false,
        clientEventId: params.dto.clientEventId,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: ERROR_CODES.AUTH_FORBIDDEN,
        message: 'Thiếu phạm vi cửa hàng để xử lý lượt quét',
        batchCode: params.dto.batchCode,
        operationType
      };
    }

    const existing = await this.prisma.scanLog.findUnique({
      where: {
        clientEventId: params.dto.clientEventId
      }
    });
    if (existing) {
      return {
        duplicated: true,
        clientEventId: existing.clientEventId,
        resultStatus: existing.resultStatus,
        resultCode: existing.resultCode,
        message: existing.message,
        batchCode: params.dto.batchCode,
        operationType: existing.operationType,
        batchId: existing.batchId,
        destinationStoreId: existing.destinationStoreId,
        scanLogId: existing.id
      };
    }

    try {
      await this.devicesService.upsert({
        deviceId: params.deviceId,
        storeId,
        userId: params.currentUser.userId
      });

      const config = await this.configService.getConfig();
      batch = await this.batchesService.findByBatchCode(storeId, params.dto.batchCode);
      const validationError = await this.validateScanRequest(
        params,
        storeId,
        operationType,
        batch,
        config.allowFifoBypass
      );

      if (validationError) {
        return validationError;
      }

      if (operationType === ScanOperationType.TRANSFER) {
      const destinationStore = await this.prisma.store.findUnique({
        where: { id: params.dto.destinationStoreId! },
        select: {
          id: true,
          name: true,
          isActive: true
        }
      });

      if (!destinationStore || !destinationStore.isActive) {
        return this.createErrorResultV2(params, {
          storeId,
          batchId: batch!.id,
          resultCode: ERROR_CODES.ERROR_TRANSFER_STORE_NOT_FOUND,
          message: 'Không tìm thấy chi nhánh nhận hợp lệ',
          operationType
        });
      }

        return this.processTransferRequest(
          params,
          storeId,
          batch!,
          destinationStore.id,
          destinationStore.name,
          config.allowFifoBypass
        );
      }

      return this.processStoreUsageRequest(params, storeId, batch!, config.allowFifoBypass);
    } catch (error) {
      const duplicated = await this.resolveDuplicateClientEvent(params, error);
      if (duplicated) {
        return duplicated;
      }

      const consumedLabelConflict = await this.resolveConsumedLabelConflict(
        params,
        storeId,
        batch?.id ?? null,
        operationType,
        error
      );
      if (consumedLabelConflict) {
        return consumedLabelConflict;
      }

      throw error;
    }
  }

  private getStoreIdForScanRequest(currentUser: JwtUser, dto: ScanDto) {
    return currentUser.role === UserRole.ADMIN ? dto.storeId : currentUser.storeId;
  }

  private hasScannedLabelData(dto: ScanDto) {
    return Boolean(
      dto.scannedLabelValue ||
        dto.scannedLabelBatchId ||
        dto.scannedLabelSequenceNumber !== undefined
    );
  }

  private getScannedLabelInfo(dto: ScanDto): ScannedLabelInfo | null {
    if (!this.hasScannedLabelData(dto)) {
      return null;
    }

    if (
      !dto.scannedLabelValue ||
      !dto.scannedLabelBatchId ||
      !dto.scannedLabelSequenceNumber
    ) {
      return null;
    }

    return {
      value: dto.scannedLabelValue,
      batchId: dto.scannedLabelBatchId,
      sequenceNumber: dto.scannedLabelSequenceNumber,
      consumedLabelKey: `${dto.scannedLabelBatchId}:${dto.scannedLabelSequenceNumber}`
    };
  }

  private async validateScanRequest(
    params: ProcessScanParams,
    storeId: string,
    operationType: ScanOperationType,
    batch: Awaited<ReturnType<BatchesService['findByBatchCode']>>,
    allowFifoBypass: boolean
  ): Promise<ProcessScanResult | null> {
    if (
      operationType === ScanOperationType.TRANSFER &&
      params.currentUser.role === UserRole.STAFF &&
      !(await this.hasTransferPermission(params.currentUser.userId))
    ) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: null,
        resultCode: ERROR_CODES.ERROR_TRANSFER_PERMISSION_REQUIRED,
        message: 'Chỉ quản trị viên mới được phép chuyển kho',
        operationType
      });
    }

    if (
      operationType === ScanOperationType.TRANSFER &&
      !params.dto.destinationStoreId
    ) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: null,
        resultCode: ERROR_CODES.ERROR_TRANSFER_DESTINATION_REQUIRED,
        message: 'Vui lòng chọn chi nhánh nhận nguyên liệu',
        operationType
      });
    }

    if (
      operationType === ScanOperationType.TRANSFER &&
      params.dto.destinationStoreId === storeId
    ) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: null,
        resultCode: ERROR_CODES.ERROR_TRANSFER_SAME_STORE,
        message: 'Chi nhánh nhận phải khác chi nhánh thực hiện',
        operationType
      });
    }

    if (params.currentUser.role !== UserRole.ADMIN) {
      const networkStatus = await this.configService.getBusinessNetworkStatus(
        storeId,
        params.ipAddress
      );
      if (!networkStatus.canAccessBusinessOperations) {
        return this.createNetworkRejectedResultV2(params, storeId, operationType);
      }
    }

    if (!batch) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: null,
        resultCode: ERROR_CODES.ERROR_BATCH_NOT_FOUND,
        message: 'Không tìm thấy lô nguyên liệu',
        operationType
      });
    }

    if (operationType === ScanOperationType.STORE_USAGE && this.hasScannedLabelData(params.dto)) {
      const scannedLabel = this.getScannedLabelInfo(params.dto);
      if (
        !scannedLabel ||
        scannedLabel.batchId !== batch.id ||
        batch.printedLabelCount < scannedLabel.sequenceNumber
      ) {
        return this.createErrorResultV2(params, {
          storeId,
          batchId: batch.id,
          resultCode: ERROR_CODES.ERROR_INVALID_QR_FORMAT,
          message: 'Tem QR khong hop le hoac chua duoc phat hanh',
          operationType
        });
      }
    }

    const scannedAt = new Date(params.dto.scannedAt);
    const isExpired = batch.expiredAt ? batch.expiredAt <= scannedAt : false;
    if (isExpired || batch.status === BatchStatus.EXPIRED) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_EXPIRED,
        message: 'Lô nguyên liệu đã hết hạn',
        operationType
      });
    }

    if (batch.status === BatchStatus.SOFT_LOCKED) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_SOFT_LOCKED,
        message: 'Lô nguyên liệu đang bị khóa mềm',
        operationType
      });
    }

    if (batch.status !== BatchStatus.ACTIVE || batch.remainingQty <= 0) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_DEPLETED,
        message: 'Lô nguyên liệu đã hết số lượng',
        operationType
      });
    }

    if (params.dto.quantityUsed > batch.remainingQty) {
      return this.createErrorResultV2(params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_INSUFFICIENT_QTY,
        message: 'Số lượng còn lại của lô không đủ',
        operationType
      });
    }

    if (!allowFifoBypass) {
      const olderBatch = await this.batchesService.findOlderActiveBatch(batch);
      if (olderBatch) {
        return this.createErrorResultV2(params, {
          storeId,
          batchId: batch.id,
          resultCode: ERROR_CODES.ERROR_FIFO,
          message: 'Đang còn lô cũ hơn. Hệ thống bắt buộc xuất theo FIFO.',
          operationType
        });
      }
    }

    return null;
  }

  private async processStoreUsageRequest(
    params: ProcessScanParams,
    storeId: string,
    batch: NonNullable<Awaited<ReturnType<BatchesService['findByBatchCode']>>>,
    allowFifoBypass: boolean
  ): Promise<ProcessScanResult> {
    const scannedLabel = this.getScannedLabelInfo(params.dto);
    if (scannedLabel) {
      const existingScan = await this.prisma.scanLog.findUnique({
        where: {
          consumedLabelKey: scannedLabel.consumedLabelKey
        }
      });

      if (existingScan) {
        return this.createErrorResultV2(params, {
          storeId,
          batchId: batch.id,
          resultCode: ERROR_CODES.ERROR_LABEL_ALREADY_SCANNED,
          message: 'Tem nay da duoc quet truoc do',
          operationType: ScanOperationType.STORE_USAGE
        });
      }
    }

    return this.prisma.runInTransaction(async (tx) => {
      const freshBatch = await tx.ingredientBatch.findUniqueOrThrow({
        where: {
          id: batch.id
        }
      });

      const freshValidationError = await this.validateFreshBatchInTransaction(
        tx,
        params,
        storeId,
        freshBatch,
        ScanOperationType.STORE_USAGE
      );
      if (freshValidationError) {
        return freshValidationError;
      }

      if (params.dto.quantityUsed > freshBatch.remainingQty) {
        return this.createErrorLogAndResultV2(tx, params, {
          storeId,
          batchId: freshBatch.id,
          resultCode: ERROR_CODES.ERROR_INSUFFICIENT_QTY,
          message: 'Số lượng còn lại của lô không đủ',
          operationType: ScanOperationType.STORE_USAGE
        });
      }

      const olderBatch = await this.batchesService.findOlderActiveBatch(freshBatch, tx);
      let resultStatus: ScanResultStatus = ScanResultStatus.SUCCESS;
      let resultCode: string = ERROR_CODES.SCAN_OK;
      let message = 'Đã ghi nhận sử dụng nguyên liệu tại quán thành công';

      if (olderBatch) {
        if (!allowFifoBypass) {
          return this.createErrorLogAndResultV2(tx, params, {
            storeId,
            batchId: freshBatch.id,
            resultCode: ERROR_CODES.ERROR_FIFO,
            message: 'Đang còn lô cũ hơn. Hệ thống bắt buộc xuất theo FIFO.',
            operationType: ScanOperationType.STORE_USAGE
          });
        }

        resultStatus = ScanResultStatus.WARNING;
        resultCode = ERROR_CODES.WARNING_FIFO;
        message = 'Cảnh báo FIFO: vẫn còn lô cũ hơn chưa được sử dụng hết';
      }

      const nextQty = freshBatch.remainingQty - params.dto.quantityUsed;
      const updatedBatch = await tx.ingredientBatch.update({
        where: { id: freshBatch.id },
        data: {
          remainingQty: nextQty,
          status: nextQty <= 0 ? BatchStatus.DEPLETED : freshBatch.status
        }
      });

      const scanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          destinationStoreId: null,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: freshBatch.id,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          operationType: ScanOperationType.STORE_USAGE,
          scannedLabelValue: scannedLabel?.value,
          consumedLabelKey: scannedLabel?.consumedLabelKey,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus,
          resultCode,
          message,
          duplicated: false
        }
      });

      return {
        duplicated: false,
        clientEventId: scanLog.clientEventId,
        resultStatus,
        resultCode,
        message,
        batchCode: params.dto.batchCode,
        operationType: ScanOperationType.STORE_USAGE,
        batchId: scanLog.batchId,
        remainingQty: updatedBatch.remainingQty,
        ingredientName: batch.ingredient.name,
        ingredientUnit: batch.ingredient.unit,
        scanLogId: scanLog.id
      };
    });
  }

  private async processTransferRequest(
    params: ProcessScanParams,
    storeId: string,
    batch: NonNullable<Awaited<ReturnType<BatchesService['findByBatchCode']>>>,
    destinationStoreId: string,
    destinationStoreName: string,
    allowFifoBypass: boolean
  ): Promise<ProcessScanResult> {
    return this.prisma.runInTransaction(async (tx) => {
      const freshBatch = await tx.ingredientBatch.findUniqueOrThrow({
        where: {
          id: batch.id
        }
      });

      const freshValidationError = await this.validateFreshBatchInTransaction(
        tx,
        params,
        storeId,
        freshBatch,
        ScanOperationType.TRANSFER
      );
      if (freshValidationError) {
        return freshValidationError;
      }

      if (params.dto.quantityUsed > freshBatch.remainingQty) {
        return this.createErrorLogAndResultV2(tx, params, {
          storeId,
          batchId: freshBatch.id,
          resultCode: ERROR_CODES.ERROR_INSUFFICIENT_QTY,
          message: 'Số lượng còn lại của lô không đủ',
          operationType: ScanOperationType.TRANSFER
        });
      }

      const olderBatch = await this.batchesService.findOlderActiveBatch(freshBatch, tx);
      let resultStatus: ScanResultStatus = ScanResultStatus.SUCCESS;
      let resultCode: string = ERROR_CODES.TRANSFER_PENDING_RECEIPT;
      let message = `Đã chuyển nguyên liệu sang chi nhánh ${destinationStoreName} thành công`;

      if (olderBatch) {
        if (!allowFifoBypass) {
          return this.createErrorLogAndResultV2(tx, params, {
            storeId,
            batchId: freshBatch.id,
            resultCode: ERROR_CODES.ERROR_FIFO,
            message: 'Đang còn lô cũ hơn. Hệ thống bắt buộc xuất theo FIFO.',
            operationType: ScanOperationType.TRANSFER
          });
        }

        resultStatus = ScanResultStatus.WARNING;
        resultCode = ERROR_CODES.WARNING_FIFO;
        message = `Cảnh báo FIFO: vẫn còn lô cũ hơn chưa được sử dụng hết trước khi chuyển sang ${destinationStoreName}`;
      }

      if (resultStatus === ScanResultStatus.SUCCESS) {
        message = `Đã tạo phiếu chuyển kho sang chi nhánh ${destinationStoreName}. Chờ chi nhánh nhận xác nhận.`;
      }

      const transferSourceQty = freshBatch.remainingQty - params.dto.quantityUsed;
      const updatedTransferSourceBatch = await tx.ingredientBatch.update({
        where: { id: freshBatch.id },
        data: {
          remainingQty: transferSourceQty,
          status: transferSourceQty <= 0 ? BatchStatus.DEPLETED : freshBatch.status
        }
      });

      const transferScanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          destinationStoreId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: freshBatch.id,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          operationType: ScanOperationType.TRANSFER,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus,
          resultCode,
          message,
          duplicated: false
        }
      });

      const createdTransfer = await tx.stockTransfer.create({
        data: {
          sourceStoreId: storeId,
          destinationStoreId,
          sourceBatchId: freshBatch.id,
          ingredientId: freshBatch.ingredientId,
          batchCode: freshBatch.batchCode,
          quantityRequested: params.dto.quantityUsed,
          status: StockTransferStatus.IN_TRANSIT,
          requestedAt: new Date(params.dto.scannedAt),
          createdByUserId: params.currentUser.userId
        }
      });

      return {
        duplicated: false,
        clientEventId: transferScanLog.clientEventId,
        resultStatus,
        resultCode,
        message,
        batchCode: params.dto.batchCode,
        operationType: ScanOperationType.TRANSFER,
        batchId: transferScanLog.batchId,
        destinationStoreId,
        remainingQty: updatedTransferSourceBatch.remainingQty,
        scanLogId: transferScanLog.id,
        transferId: createdTransfer.id,
        transferStatus: createdTransfer.status
      };

      /* Legacy immediate destination-stock update flow kept for reference.
      const targetBatch = await tx.ingredientBatch.findUnique({
        where: {
          storeId_batchCode: {
            storeId: destinationStoreId,
            batchCode: freshBatch.batchCode
          }
        }
      });

      if (targetBatch && targetBatch.ingredientId !== freshBatch.ingredientId) {
        return this.createErrorLogAndResultV2(tx, params, {
          storeId,
          batchId: freshBatch.id,
          resultCode: ERROR_CODES.ERROR_TRANSFER_BATCH_CONFLICT,
          message: 'Chi nhánh nhận đang có lô trùng mã nhưng khác nguyên liệu',
          operationType: ScanOperationType.TRANSFER
        });
      }

      const nextSourceQty = freshBatch.remainingQty - params.dto.quantityUsed;
      const updatedSourceBatch = await tx.ingredientBatch.update({
        where: { id: freshBatch.id },
        data: {
          remainingQty: nextSourceQty,
          status: nextSourceQty <= 0 ? BatchStatus.DEPLETED : freshBatch.status
        }
      });

      if (targetBatch) {
        const nextTargetQty = targetBatch.remainingQty + params.dto.quantityUsed;
        await tx.ingredientBatch.update({
          where: { id: targetBatch.id },
          data: {
            initialQty: targetBatch.initialQty + params.dto.quantityUsed,
            remainingQty: nextTargetQty,
            status:
              targetBatch.status === BatchStatus.DEPLETED && nextTargetQty > 0
                ? BatchStatus.ACTIVE
                : targetBatch.status
          }
        });
      } else {
        await tx.ingredientBatch.create({
          data: {
            ingredientId: freshBatch.ingredientId,
            storeId: destinationStoreId,
            batchCode: freshBatch.batchCode,
            receivedAt: freshBatch.receivedAt,
            expiredAt: freshBatch.expiredAt,
            initialQty: params.dto.quantityUsed,
            remainingQty: params.dto.quantityUsed,
            status: BatchStatus.ACTIVE,
            softLockReason: null,
            qrCodeValue: freshBatch.qrCodeValue,
            qrGeneratedAt: freshBatch.qrGeneratedAt,
            labelCreatedAt: freshBatch.labelCreatedAt,
            printedLabelCount: 0
          }
        });
      }

      const scanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          destinationStoreId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: freshBatch.id,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          operationType: ScanOperationType.TRANSFER,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus,
          resultCode,
          message,
          duplicated: false
        }
      });

      return {
        duplicated: false,
        clientEventId: scanLog.clientEventId,
        resultStatus,
        resultCode,
        message,
        batchCode: params.dto.batchCode,
        operationType: ScanOperationType.TRANSFER,
        batchId: scanLog.batchId,
        destinationStoreId,
        remainingQty: updatedSourceBatch.remainingQty,
        scanLogId: scanLog.id
      };
      */
    });
  }

  private async createNetworkRejectedResultV2(
    params: ProcessScanParams,
    storeId: string,
    operationType: ScanOperationType
  ): Promise<ProcessScanResult> {
    const detail = `IP ${params.ipAddress} không nằm trong danh sách mạng được phép`;

    return this.prisma.runInTransaction(async (tx) => {
      await tx.fraudAttemptLog.create({
        data: {
          storeId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          attemptType: FraudAttemptType.NETWORK_RESTRICTED,
          detail
        }
      });

      const scanLog = await tx.scanLog.create({
        data: {
          clientEventId: params.dto.clientEventId,
          storeId,
          destinationStoreId: params.dto.destinationStoreId,
          userId: params.currentUser.userId,
          deviceId: params.deviceId,
          batchId: null,
          quantityUsed: params.dto.quantityUsed,
          scannedAt: new Date(params.dto.scannedAt),
          receivedAt: new Date(),
          source: params.source,
          entryMethod: params.entryMethod,
          operationType,
          ipAddress: params.ipAddress,
          ssid: params.dto.ssid,
          resultStatus: ScanResultStatus.ERROR,
          resultCode: ERROR_CODES.ERROR_NETWORK_RESTRICTED,
          message: 'Lượt quét bị từ chối vì mạng hiện tại chưa được cho phép'
        }
      });

      return {
        duplicated: false,
        clientEventId: params.dto.clientEventId,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: ERROR_CODES.ERROR_NETWORK_RESTRICTED,
        message: 'Lượt quét bị từ chối vì mạng hiện tại chưa được cho phép',
        batchCode: params.dto.batchCode,
        operationType,
        batchId: null,
        destinationStoreId: params.dto.destinationStoreId,
        scanLogId: scanLog.id
      };
    });
  }

  private async createErrorResultV2(
    params: ProcessScanParams,
    payload: {
      storeId: string;
      batchId: string | null;
      resultCode: string;
      message: string;
      operationType: ScanOperationType;
    }
  ): Promise<ProcessScanResult> {
    return this.prisma.runInTransaction((tx) =>
      this.createErrorLogAndResultV2(tx, params, payload)
    );
  }

  private async createErrorLogAndResultV2(
    tx: Prisma.TransactionClient,
    params: ProcessScanParams,
    payload: {
      storeId: string;
      batchId: string | null;
      resultCode: string;
      message: string;
      operationType: ScanOperationType;
    }
  ): Promise<ProcessScanResult> {
    const scanLog = await tx.scanLog.create({
      data: {
        clientEventId: params.dto.clientEventId,
        storeId: payload.storeId,
        destinationStoreId: params.dto.destinationStoreId,
        userId: params.currentUser.userId,
        deviceId: params.deviceId,
        batchId: payload.batchId,
        quantityUsed: params.dto.quantityUsed,
        scannedAt: new Date(params.dto.scannedAt),
        receivedAt: new Date(),
        source: params.source,
        entryMethod: params.entryMethod,
        operationType: payload.operationType,
        scannedLabelValue: params.dto.scannedLabelValue,
        ipAddress: params.ipAddress,
        ssid: params.dto.ssid,
        resultStatus: ScanResultStatus.ERROR,
        resultCode: payload.resultCode,
        message: payload.message
      }
    });

    return {
      duplicated: false,
      clientEventId: params.dto.clientEventId,
      resultStatus: ScanResultStatus.ERROR,
      resultCode: payload.resultCode,
      message: payload.message,
      batchCode: params.dto.batchCode,
      operationType: payload.operationType,
      batchId: payload.batchId,
      destinationStoreId: params.dto.destinationStoreId,
      scanLogId: scanLog.id
    };
  }

  private async validateFreshBatchInTransaction(
    tx: Prisma.TransactionClient,
    params: ProcessScanParams,
    storeId: string,
    batch: {
      id: string;
      expiredAt: Date | null;
      status: BatchStatus;
      remainingQty: number;
    },
    operationType: ScanOperationType
  ): Promise<ProcessScanResult | null> {
    const scannedAt = new Date(params.dto.scannedAt);
    const isExpired = batch.expiredAt ? batch.expiredAt <= scannedAt : false;
    if (isExpired || batch.status === BatchStatus.EXPIRED) {
      return this.createErrorLogAndResultV2(tx, params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_EXPIRED,
        message: 'LÃ´ nguyÃªn liá»‡u Ä‘Ã£ háº¿t háº¡n',
        operationType
      });
    }

    if (batch.status === BatchStatus.SOFT_LOCKED) {
      return this.createErrorLogAndResultV2(tx, params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_SOFT_LOCKED,
        message: 'LÃ´ nguyÃªn liá»‡u Ä‘ang bá»‹ khÃ³a má»m',
        operationType
      });
    }

    if (batch.status !== BatchStatus.ACTIVE || batch.remainingQty <= 0) {
      return this.createErrorLogAndResultV2(tx, params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_BATCH_DEPLETED,
        message: 'LÃ´ nguyÃªn liá»‡u Ä‘Ã£ háº¿t sá»‘ lÆ°á»£ng',
        operationType
      });
    }

    if (params.dto.quantityUsed > batch.remainingQty) {
      return this.createErrorLogAndResultV2(tx, params, {
        storeId,
        batchId: batch.id,
        resultCode: ERROR_CODES.ERROR_INSUFFICIENT_QTY,
        message: 'Sá»‘ lÆ°á»£ng cÃ²n láº¡i cá»§a lÃ´ khÃ´ng Ä‘á»§',
        operationType
      });
    }

    return null;
  }

  private async resolveDuplicateClientEvent(
    params: ProcessScanParams,
    error: unknown
  ): Promise<ProcessScanResult | null> {
    if (!this.prisma.isUniqueConstraintError(error, ['clientEventId'])) {
      return null;
    }

    const existing = await this.prisma.scanLog.findUnique({
      where: {
        clientEventId: params.dto.clientEventId
      }
    });

    if (!existing) {
      return null;
    }

    return {
      duplicated: true,
      clientEventId: existing.clientEventId,
      resultStatus: existing.resultStatus,
      resultCode: existing.resultCode,
      message: existing.message,
      batchCode: params.dto.batchCode,
      operationType: existing.operationType,
      batchId: existing.batchId,
      destinationStoreId: existing.destinationStoreId,
      scanLogId: existing.id
    };
  }

  private async resolveConsumedLabelConflict(
    params: ProcessScanParams,
    storeId: string,
    batchId: string | null,
    operationType: ScanOperationType,
    error: unknown
  ): Promise<ProcessScanResult | null> {
    if (operationType !== ScanOperationType.STORE_USAGE) {
      return null;
    }

    if (!this.getScannedLabelInfo(params.dto)) {
      return null;
    }

    if (!this.prisma.isUniqueConstraintError(error, ['consumedLabelKey'])) {
      return null;
    }

    return this.createErrorResultV2(params, {
      storeId,
      batchId,
      resultCode: ERROR_CODES.ERROR_LABEL_ALREADY_SCANNED,
      message: 'Tem nay da duoc quet truoc do',
      operationType
    });
  }

  private async buildEnhancedLogWhere(currentUser: JwtUser, query: QueryScanLogsDto) {
    const scannedAt: Prisma.DateTimeFilter | undefined =
      query.startDate || query.endDate
        ? {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {})
          }
        : undefined;

    const baseWhere: Prisma.ScanLogWhereInput = {
      ...(query.resultStatus ? { resultStatus: query.resultStatus } : {}),
      ...(query.operationType ? { operationType: query.operationType } : {}),
      ...(scannedAt ? { scannedAt } : {}),
      ...(query.batchCode
        ? {
            batch: {
              batchCode: {
                contains: query.batchCode,
                mode: 'insensitive'
              }
            }
          }
        : {})
    };

    const scopedStoreWhere = (storeId: string): Prisma.ScanLogWhereInput =>
      query.operationType === ScanOperationType.TRANSFER
        ? {
            OR: [{ storeId }, { destinationStoreId: storeId }]
          }
        : {
            storeId
          };

    if (currentUser.role === UserRole.ADMIN) {
      return {
        ...baseWhere,
        ...(query.storeId ? scopedStoreWhere(query.storeId) : {}),
        ...(query.userId ? { userId: query.userId } : {})
      };
    }

    if (currentUser.role === UserRole.MANAGER) {
      return {
        ...baseWhere,
        ...scopedStoreWhere(currentUser.storeId!),
        ...(query.userId ? { userId: query.userId } : {})
      };
    }

    return {
      ...baseWhere,
      ...scopedStoreWhere(currentUser.storeId!),
      userId: currentUser.userId
    };
  }

  private async hasTransferPermission(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: true
      }
    });

    return Boolean(user?.permissions.includes(PERMISSIONS.SCAN_TRANSFER));
  }
}
