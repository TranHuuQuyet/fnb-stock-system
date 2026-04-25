import { BatchesService } from './batches.service';

describe('BatchesService', () => {
  const prisma = {
    ingredient: {
      findUnique: jest.fn()
    },
    store: {
      findUnique: jest.fn()
    },
    ingredientBatch: {
      create: jest.fn()
    }
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new BatchesService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects creating a batch for an inactive store', async () => {
    prisma.ingredient.findUnique.mockResolvedValue({
      id: 'ingredient-1',
      name: 'Milk'
    });
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      isActive: false
    });

    await expect(
      service.create('admin-1', {
        ingredientId: 'ingredient-1',
        storeId: 'store-1',
        batchCode: 'BATCH-001',
        receivedAt: '2026-04-25T00:00:00.000Z',
        initialQty: 10
      })
    ).rejects.toMatchObject({
      response: {
        code: 'ADMIN_ERROR_STORE_NOT_FOUND'
      },
      status: 404
    });

    expect(prisma.ingredientBatch.create).not.toHaveBeenCalled();
  });
});
