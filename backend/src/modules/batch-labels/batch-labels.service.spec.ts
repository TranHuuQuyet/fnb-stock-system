import { BatchLabelsService } from './batch-labels.service';

describe('BatchLabelsService', () => {
  const prisma = {
    $transaction: jest.fn()
  };
  const batchesService = {
    getById: jest.fn(),
    generateQrCodeValue: jest.fn()
  };
  const auditService = {
    createLog: jest.fn()
  };

  const service = new BatchLabelsService(
    prisma as never,
    batchesService as never,
    auditService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates qr value with FNBBATCH prefix', async () => {
    batchesService.getById.mockResolvedValue({
      id: 'batch-1',
      batchCode: 'BATCH-001',
      ingredient: { name: 'Tea' },
      qrCodeValue: null,
      qrGeneratedAt: null,
      labelCreatedAt: null,
      receivedAt: new Date(),
      expiredAt: null
    });
    batchesService.generateQrCodeValue.mockReturnValue('FNBBATCH:BATCH-001');
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback({
        ingredientBatch: {
          update: jest.fn().mockResolvedValue({
            id: 'batch-1',
            batchCode: 'BATCH-001',
            ingredient: { name: 'Tea' },
            store: { name: 'Demo' },
            qrCodeValue: 'FNBBATCH:BATCH-001',
            qrGeneratedAt: new Date(),
            receivedAt: new Date(),
            expiredAt: null
          })
        }
      })
    );

    const result = await service.generateQr('admin-1', 'batch-1');

    expect(result.qrCodeValue).toBe('FNBBATCH:BATCH-001');
  });
});
