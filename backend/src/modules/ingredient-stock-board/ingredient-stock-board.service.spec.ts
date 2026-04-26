import { ScanOperationType, UserRole } from '@prisma/client';

import { IngredientStockBoardService } from './ingredient-stock-board.service';

describe('IngredientStockBoardService', () => {
  const prisma = {
    store: {
      findUnique: jest.fn()
    },
    workSchedule: {
      findUnique: jest.fn()
    },
    ingredientStockLayout: {
      findUnique: jest.fn()
    },
    scanLog: {
      findMany: jest.fn()
    },
    ingredientBatch: {
      findMany: jest.fn()
    },
    ingredientGroup: {
      findMany: jest.fn()
    },
    ingredient: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new IngredientStockBoardService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps warehouse remaining stock aligned with all positive batch remaining quantities', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      code: 'CN1',
      name: 'Chi nhanh 1',
      timezone: 'Asia/Ho_Chi_Minh'
    });
    prisma.workSchedule.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([
      null,
      [],
      [
        { ingredientId: 'ingredient-1', remainingQty: 7 },
        { ingredientId: 'ingredient-1', remainingQty: 2 }
      ],
      [{ id: 'group-1', name: 'Dairy' }],
      [
        {
          id: 'ingredient-1',
          code: 'MILK',
          name: 'Milk',
          unit: 'l',
          isActive: true,
          groupId: 'group-1',
          group: { name: 'Dairy' }
        }
      ]
    ]);

    const result = await service.getBoard(
      {
        userId: 'admin-1',
        username: 'admin',
        role: UserRole.ADMIN,
        storeId: 'store-1',
        permissions: []
      },
      {
        storeId: 'store-1',
        year: 2026,
        month: 4,
        operationType: ScanOperationType.STORE_USAGE
      }
    );

    expect(prisma.ingredientBatch.findMany).toHaveBeenCalledWith({
      where: {
        storeId: 'store-1',
        remainingQty: {
          gt: 0
        }
      },
      select: {
        ingredientId: true,
        remainingQty: true
      }
    });
    expect(result.layout.groups[0]?.items[0]?.totalRemainingQty).toBe(9);
    expect(result.options.ingredients[0]?.totalRemainingQty).toBe(9);
  });
});
