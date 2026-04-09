import { UserRole, ScanResultStatus } from '@prisma/client';

import { PosService } from './pos.service';

describe('PosService', () => {
  const prisma = {
    posSale: {
      findMany: jest.fn()
    },
    store: {
      findUniqueOrThrow: jest.fn()
    },
    scanLog: {
      findMany: jest.fn()
    }
  };
  const auditService = {
    createLog: jest.fn()
  };
  const configService = {
    getConfig: jest.fn()
  };

  const service = new PosService(
    prisma as never,
    auditService as never,
    configService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates reconciliation ratio from pos sales and scan logs', async () => {
    configService.getConfig.mockResolvedValue({
      anomalyThreshold: 0.7
    });
    prisma.posSale.findMany.mockResolvedValue([
      {
        qtySold: 10,
        product: {
          recipes: [
            {
              ingredientId: 'ingredient-1',
              qtyPerUnit: 0.1,
              ingredient: {
                name: 'Tea Leaf'
              }
            }
          ]
        }
      }
    ]);
    prisma.store.findUniqueOrThrow.mockResolvedValue({
      id: 'store-1',
      timezone: 'Asia/Ho_Chi_Minh'
    });
    prisma.scanLog.findMany.mockResolvedValue([
      {
        quantityUsed: 0.4,
        scannedAt: new Date('2026-04-08T01:00:00.000Z'),
        resultStatus: ScanResultStatus.SUCCESS,
        batch: {
          ingredientId: 'ingredient-1',
          ingredient: {
            name: 'Tea Leaf'
          }
        }
      }
    ]);

    const result = await service.getReconciliation(
      {
        userId: 'manager-1',
        username: 'manager1',
        role: UserRole.MANAGER,
        storeId: 'store-1',
        status: 'ACTIVE'
      },
      'store-1',
      '2026-04-08'
    );

    expect(result.items[0]?.expectedQty).toBe(1);
    expect(result.items[0]?.actualQty).toBe(0.4);
    expect(result.items[0]?.belowThreshold).toBe(true);
  });
});
