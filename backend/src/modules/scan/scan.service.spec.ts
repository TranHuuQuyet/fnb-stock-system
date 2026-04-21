import {
  BatchStatus,
  ScanEntryMethod,
  ScanResultStatus,
  ScanSource,
  UserRole,
  UserStatus
} from '@prisma/client';

import { ScanService } from './scan.service';

describe('ScanService', () => {
  const prisma = {
    scanLog: {
      findUnique: jest.fn()
    },
    runInTransaction: jest.fn(),
    isUniqueConstraintError: jest.fn().mockReturnValue(false)
  };
  const devicesService = {
    upsert: jest.fn()
  };
  const configService = {
    getConfig: jest.fn(),
    getActiveWhitelistsByStore: jest.fn(),
    getBusinessNetworkStatus: jest.fn()
  };
  const batchesService = {
    findByBatchCode: jest.fn(),
    findOlderActiveBatch: jest.fn()
  };

  const service = new ScanService(
    prisma as never,
    devicesService as never,
    configService as never,
    batchesService as never
  );

  const currentUser = {
    userId: 'staff-1',
    username: 'staff1',
    role: UserRole.STAFF,
    storeId: 'store-1',
    status: UserStatus.ACTIVE,
    sessionVersion: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns duplicate result without reprocessing stock', async () => {
    prisma.scanLog.findUnique.mockResolvedValue({
      id: 'scan-1',
      clientEventId: 'event-1',
      resultStatus: ScanResultStatus.SUCCESS,
      resultCode: 'SCAN_OK',
      message: 'Duplicated',
      batchId: 'batch-1'
    });

    const result = await service.sync(
      currentUser,
      [
        {
          batchCode: 'BATCH-001',
          quantityUsed: 0.1,
          scannedAt: new Date().toISOString(),
          clientEventId: 'event-1'
        }
      ],
      'device-1',
      '127.0.0.1'
    );

    expect(result.data[0]?.duplicated).toBe(true);
    expect(devicesService.upsert).not.toHaveBeenCalled();
  });

  it('returns warning when fifo bypass is enabled and older batch exists', async () => {
    prisma.scanLog.findUnique.mockResolvedValue(null);
    configService.getConfig.mockResolvedValue({ allowFifoBypass: true });
    configService.getBusinessNetworkStatus.mockResolvedValue({
      canAccessBusinessOperations: true
    });
    batchesService.findByBatchCode.mockResolvedValue({
      id: 'batch-2',
      ingredientId: 'ingredient-1',
      storeId: 'store-1',
      batchCode: 'BATCH-002',
      receivedAt: new Date('2026-04-04T00:00:00.000Z'),
      expiredAt: null,
      remainingQty: 10,
      status: BatchStatus.ACTIVE
    });
    batchesService.findOlderActiveBatch.mockResolvedValue({
      id: 'older-batch'
    });
    prisma.runInTransaction.mockImplementation(async (callback: Function) =>
      callback({
        ingredientBatch: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'batch-2',
            remainingQty: 10,
            status: BatchStatus.ACTIVE
          }),
          update: jest.fn().mockResolvedValue({
            remainingQty: 9.5
          })
        },
        scanLog: {
          create: jest.fn().mockResolvedValue({
            id: 'scan-2',
            clientEventId: 'event-2',
            batchId: 'batch-2'
          })
        }
      })
    );

    const result = await service.scan(
      currentUser,
      {
        batchCode: 'BATCH-002',
        quantityUsed: 0.5,
        scannedAt: new Date().toISOString(),
        clientEventId: 'event-2',
        entryMethod: ScanEntryMethod.CAMERA
      },
      'device-1',
      '127.0.0.1'
    );

    expect(result.resultStatus).toBe(ScanResultStatus.WARNING);
    expect(result.resultCode).toBe('WARNING_FIFO');
  });

  it('normalizes ipv4-mapped addresses when checking current network status', async () => {
    configService.getBusinessNetworkStatus.mockResolvedValue({
      storeId: 'store-1',
      ipAddress: '::ffff:127.0.0.1',
      normalizedIpAddress: '127.0.0.1',
      hasActiveWhitelist: true,
      isAllowedByWhitelist: true,
      matchedWhitelistTypes: ['IP'],
      bypassEnabled: false,
      bypassActive: false,
      bypassExpiresAt: null,
      bypassReason: null,
      canAccessBusinessOperations: true
    });

    const result = await service.getNetworkStatus(
      currentUser,
      undefined,
      '::ffff:127.0.0.1'
    );

    expect(result.storeId).toBe('store-1');
    expect(result.ipAddress).toBe('::ffff:127.0.0.1');
    expect(result.normalizedIpAddress).toBe('127.0.0.1');
    expect(result.hasActiveWhitelist).toBe(true);
    expect(result.isAllowedByWhitelist).toBe(true);
    expect(result.matchedWhitelistTypes).toEqual(['IP']);
  });
});
