import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { UsersController } from '../src/modules/users/users.controller';
import { ScanController } from '../src/modules/scan/scan.controller';
import { IngredientsController } from '../src/modules/ingredients/ingredients.controller';
import { BatchesController } from '../src/modules/batches/batches.controller';
import { BatchLabelsController } from '../src/modules/batch-labels/batch-labels.controller';
import { StockAdjustmentsController } from '../src/modules/stock-adjustments/stock-adjustments.controller';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';

describe('API routes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        ScanController,
        IngredientsController,
        BatchesController,
        BatchLabelsController,
        StockAdjustmentsController
      ],
      providers: [
        {
          provide: 'AuthService',
          useValue: {
            login: jest.fn().mockResolvedValue({
              accessToken: 'token',
              user: { username: 'admin' },
              mustChangePassword: false
            }),
            me: jest.fn().mockResolvedValue({ username: 'admin' }),
            logout: jest.fn().mockResolvedValue({ loggedOut: true }),
            changePassword: jest.fn().mockResolvedValue({ status: 'ACTIVE' })
          }
        },
        {
          provide: 'UsersService',
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'user-1', username: 'staff3' }),
            list: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
            getById: jest.fn().mockResolvedValue({ id: 'user-1' }),
            update: jest.fn().mockResolvedValue({ id: 'user-1' }),
            lock: jest.fn().mockResolvedValue({ id: 'user-1', status: 'LOCKED' }),
            unlock: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE' }),
            resetPassword: jest.fn().mockResolvedValue({ userId: 'user-1', temporaryPassword: '123456' })
          }
        },
        {
          provide: 'ScanService',
          useValue: {
            scan: jest.fn().mockResolvedValue({ resultStatus: 'SUCCESS', resultCode: 'SCAN_OK', message: 'ok' }),
            manualScan: jest.fn().mockResolvedValue({ resultStatus: 'SUCCESS', resultCode: 'SCAN_OK', message: 'ok' }),
            sync: jest.fn().mockResolvedValue({ data: [{ duplicated: true }], synced: 1, failed: 0 }),
            listLogs: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
          }
        },
        {
          provide: 'IngredientsService',
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
            list: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
            getById: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
            update: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
            disable: jest.fn().mockResolvedValue({ id: 'ingredient-1', isActive: false })
          }
        },
        {
          provide: 'BatchesService',
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
            listAdmin: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
            listAccessible: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
            getById: jest.fn().mockResolvedValue({ id: 'batch-1' }),
            update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
            softLock: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'SOFT_LOCKED' }),
            unlock: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'ACTIVE' })
          }
        },
        {
          provide: 'BatchLabelsService',
          useValue: {
            generateQr: jest.fn().mockResolvedValue({ qrCodeValue: 'FNBBATCH:BATCH-1' }),
            getQr: jest.fn().mockResolvedValue({ qrCodeValue: 'FNBBATCH:BATCH-1' }),
            getLabel: jest.fn().mockResolvedValue({ batchCode: 'BATCH-1', qrCodeValue: 'FNBBATCH:BATCH-1' })
          }
        },
        {
          provide: 'StockAdjustmentsService',
          useValue: {
            create: jest.fn().mockResolvedValue({ adjustment: { id: 'adj-1' } }),
            list: jest.fn().mockResolvedValue([])
          }
        }
      ]
    })
      .overrideProvider(require('../src/modules/auth/auth.service').AuthService)
      .useValue({
        login: jest.fn().mockResolvedValue({
          accessToken: 'token',
          user: { username: 'admin' },
          mustChangePassword: false
        }),
        me: jest.fn().mockResolvedValue({ username: 'admin' }),
        logout: jest.fn().mockResolvedValue({ loggedOut: true }),
        changePassword: jest.fn().mockResolvedValue({ status: 'ACTIVE' })
      })
      .overrideProvider(require('../src/modules/users/users.service').UsersService)
      .useValue({
        create: jest.fn().mockResolvedValue({ id: 'user-1', username: 'staff3' }),
        list: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
        getById: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
        lock: jest.fn().mockResolvedValue({ id: 'user-1', status: 'LOCKED' }),
        unlock: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE' }),
        resetPassword: jest.fn().mockResolvedValue({ userId: 'user-1', temporaryPassword: '123456' })
      })
      .overrideProvider(require('../src/modules/scan/scan.service').ScanService)
      .useValue({
        scan: jest.fn().mockResolvedValue({ resultStatus: 'SUCCESS', resultCode: 'SCAN_OK', message: 'ok' }),
        manualScan: jest.fn().mockResolvedValue({ resultStatus: 'SUCCESS', resultCode: 'SCAN_OK', message: 'ok' }),
        sync: jest.fn().mockResolvedValue({ data: [{ duplicated: true }], synced: 1, failed: 0 }),
        listLogs: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
      })
      .overrideProvider(require('../src/modules/ingredients/ingredients.service').IngredientsService)
      .useValue({
        create: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
        list: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
        getById: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
        update: jest.fn().mockResolvedValue({ id: 'ingredient-1' }),
        disable: jest.fn().mockResolvedValue({ id: 'ingredient-1', isActive: false })
      })
      .overrideProvider(require('../src/modules/batches/batches.service').BatchesService)
      .useValue({
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        listAdmin: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
        listAccessible: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
        getById: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        softLock: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'SOFT_LOCKED' }),
        unlock: jest.fn().mockResolvedValue({ id: 'batch-1', status: 'ACTIVE' })
      })
      .overrideProvider(require('../src/modules/batch-labels/batch-labels.service').BatchLabelsService)
      .useValue({
        generateQr: jest.fn().mockResolvedValue({ qrCodeValue: 'FNBBATCH:BATCH-1' }),
        getQr: jest.fn().mockResolvedValue({ qrCodeValue: 'FNBBATCH:BATCH-1' }),
        getLabel: jest.fn().mockResolvedValue({ batchCode: 'BATCH-1', qrCodeValue: 'FNBBATCH:BATCH-1' })
      })
      .overrideProvider(require('../src/modules/stock-adjustments/stock-adjustments.service').StockAdjustmentsService)
      .useValue({
        create: jest.fn().mockResolvedValue({ adjustment: { id: 'adj-1' } }),
        list: jest.fn().mockResolvedValue([])
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res, next) => {
      req.requestId = 'test-request-id';
      req.user = {
        userId: 'admin-1',
        username: 'admin',
        role: 'ADMIN',
        storeId: 'store-1',
        status: 'ACTIVE'
      };
      next();
    });
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: '123456' })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('POST /admin/users', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/users')
      .send({
        username: 'staff3',
        fullName: 'Staff 3',
        role: 'STAFF',
        storeId: 'store-1',
        temporaryPassword: '123456'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('POST /scan', async () => {
    const response = await request(app.getHttpServer())
      .post('/scan')
      .send({
        batchCode: 'BATCH-1',
        quantityUsed: 0.5,
        scannedAt: new Date().toISOString(),
        clientEventId: '00000000-0000-4000-8000-000000000001'
      })
      .expect(201);

    expect(response.body.data.resultCode).toBe('SCAN_OK');
  });

  it('POST /scan/manual', async () => {
    const response = await request(app.getHttpServer())
      .post('/scan/manual')
      .send({
        batchCode: 'BATCH-1',
        quantityUsed: 0.5,
        scannedAt: new Date().toISOString(),
        clientEventId: '00000000-0000-4000-8000-000000000002'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('POST /admin/ingredients', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/ingredients')
      .send({
        code: 'NEW',
        name: 'New Ingredient',
        unit: 'kg'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('POST /admin/batches', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/batches')
      .send({
        ingredientId: 'ingredient-1',
        storeId: 'store-1',
        batchCode: 'BATCH-NEW',
        receivedAt: new Date().toISOString(),
        initialQty: 10
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('POST /admin/batches/:id/generate-qr', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/batches/batch-1/generate-qr')
      .send({})
      .expect(201);

    expect(response.body.data.qrCodeValue).toContain('FNBBATCH:');
  });

  it('GET /admin/batches/:id/label', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/batches/batch-1/label')
      .expect(200);

    expect(response.body.data.batchCode).toBe('BATCH-1');
  });

  it('POST /admin/batches/:id/adjustments', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/batches/batch-1/adjustments')
      .send({
        adjustmentType: 'DECREASE',
        quantity: 1,
        reason: 'test'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });
});
