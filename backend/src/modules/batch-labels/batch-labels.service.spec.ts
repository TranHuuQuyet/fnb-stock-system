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
      initialQty: 50,
      printedLabelCount: 0,
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
            initialQty: 50,
            printedLabelCount: 0,
            ingredient: { name: 'Tea', unit: 'bag' },
            store: { name: 'Demo' },
            qrCodeValue: 'FNBBATCH:BATCH-001',
            qrGeneratedAt: new Date(),
            labelCreatedAt: null,
            receivedAt: new Date(),
            expiredAt: null
          })
        }
      })
    );

    const result = await service.generateQr('admin-1', 'batch-1');

    expect(result.qrCodeValue).toBe('FNBBATCH:BATCH-001');
  });

  it('requires a reason when issuing more labels for a batch that was already printed', async () => {
    batchesService.generateQrCodeValue.mockReturnValue('FNBBATCH:BATCH-001');
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback({
        ingredientBatch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-1',
            batchCode: 'BATCH-001',
            initialQty: 50,
            printedLabelCount: 10,
            ingredient: { name: 'Milk', unit: 'box' },
            store: { name: 'Demo Store' },
            qrCodeValue: 'FNBBATCH:BATCH-001',
            qrGeneratedAt: new Date('2026-04-10T01:00:00.000Z'),
            labelCreatedAt: new Date('2026-04-10T01:00:00.000Z'),
            receivedAt: new Date('2026-04-10T00:00:00.000Z'),
            expiredAt: null
          })
        }
      })
    );

    await expect(service.issueLabels('admin-1', 'batch-1', 2)).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_INVALID_PAYLOAD'
      }
    });
  });

  it('issues sequential label numbers for a batch', async () => {
    batchesService.generateQrCodeValue.mockReturnValue('FNBBATCH:BATCH-001');
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback({
        ingredientBatch: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'batch-1',
              batchCode: 'BATCH-001',
              initialQty: 50,
              printedLabelCount: 10,
              ingredient: { name: 'Milk', unit: 'box' },
              store: { name: 'Demo Store' },
              qrCodeValue: 'FNBBATCH:BATCH-001',
              qrGeneratedAt: new Date('2026-04-10T01:00:00.000Z'),
              labelCreatedAt: new Date('2026-04-10T01:00:00.000Z'),
              receivedAt: new Date('2026-04-10T00:00:00.000Z'),
              expiredAt: null
            })
            .mockResolvedValueOnce({
              id: 'batch-1',
              batchCode: 'BATCH-001',
              initialQty: 50,
              printedLabelCount: 20,
              ingredient: { name: 'Milk', unit: 'box' },
              store: { name: 'Demo Store' },
              qrCodeValue: 'FNBBATCH:BATCH-001',
              qrGeneratedAt: new Date('2026-04-10T01:00:00.000Z'),
              labelCreatedAt: new Date('2026-04-10T02:00:00.000Z'),
              receivedAt: new Date('2026-04-10T00:00:00.000Z'),
              expiredAt: null
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'batch-1',
            batchCode: 'BATCH-001',
            initialQty: 50,
            printedLabelCount: 20,
            ingredient: { name: 'Milk', unit: 'box' },
            store: { name: 'Demo Store' },
            qrCodeValue: 'FNBBATCH:BATCH-001',
            qrGeneratedAt: new Date('2026-04-10T01:00:00.000Z'),
            labelCreatedAt: new Date('2026-04-10T02:00:00.000Z'),
            receivedAt: new Date('2026-04-10T00:00:00.000Z'),
            expiredAt: null
          })
        }
      })
    );

    const result = await service.issueLabels(
      'admin-1',
      'batch-1',
      10,
      'In bo sung do tem cu bi hong'
    );

    expect(result.issuedFromNumber).toBe(11);
    expect(result.issuedToNumber).toBe(20);
    expect(result.labels).toEqual(
      Array.from({ length: 10 }, (_, index) => ({
        sequenceNumber: index + 11,
        qrCodeValue: `FNBBATCH:BATCH-001|BATCH:batch-1|SEQ:${index + 11}`
      }))
    );
  });
});
