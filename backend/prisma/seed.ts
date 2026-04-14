import { PrismaClient, AlertSeverity, AlertStatus, BatchStatus, ScanEntryMethod, ScanResultStatus, ScanSource, StockAdjustmentType, UserRole, UserStatus, WorkEntryType, WorkScheduleStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const toBusinessDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const batchQr = (batchCode: string) => `FNBBATCH:${batchCode}`;
const normalizeUnit = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeGroupName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
const buildIngredientUpsertPayload = (code: string, name: string, unit: string, groupId: string) => ({
  where: { code },
  update: {
    name,
    unit,
    isActive: true,
    group: { connect: { id: groupId } }
  },
  create: {
    code,
    name,
    unit,
    isActive: true,
    group: { connect: { id: groupId } }
  }
});

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);
  const businessDate = toBusinessDate();
  const businessDateValue = new Date(`${businessDate}T00:00:00.000Z`);

  const store = await prisma.store.upsert({
    where: { code: 'STORE-HCM-01' },
    update: {
      name: 'Cửa hàng demo FNB',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    },
    create: {
      code: 'STORE-HCM-01',
      name: 'Cửa hàng demo FNB',
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    }
  });

  const [admin, manager, staff1, staff2] = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {
        fullName: 'Quản trị hệ thống',
        role: UserRole.ADMIN,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: []
      },
      create: {
        username: 'admin',
        fullName: 'Quản trị hệ thống',
        role: UserRole.ADMIN,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: []
      }
    }),
    prisma.user.upsert({
      where: { username: 'manager1' },
      update: {
        fullName: 'Quản lý cửa hàng 1',
        role: UserRole.MANAGER,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: ['view_scan', 'view_profile', 'view_scan_logs', 'view_dashboard']
      },
      create: {
        username: 'manager1',
        fullName: 'Quản lý cửa hàng 1',
        role: UserRole.MANAGER,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: ['view_scan', 'view_profile', 'view_scan_logs', 'view_dashboard']
      }
    }),
    prisma.user.upsert({
      where: { username: 'staff1' },
      update: {
        fullName: 'Nhân viên đang hoạt động 1',
        role: UserRole.STAFF,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: ['view_scan', 'view_profile']
      },
      create: {
        username: 'staff1',
        fullName: 'Nhân viên đang hoạt động 1',
        role: UserRole.STAFF,
        storeId: store.id,
        passwordHash,
        status: UserStatus.ACTIVE,
        permissions: ['view_scan', 'view_profile']
      }
    }),
    prisma.user.upsert({
      where: { username: 'staff2' },
      update: {
        fullName: 'Nhân viên cần đổi mật khẩu',
        role: UserRole.STAFF,
        storeId: store.id,
        passwordHash,
        status: UserStatus.MUST_CHANGE_PASSWORD,
        permissions: ['view_scan', 'view_profile']
      },
      create: {
        username: 'staff2',
        fullName: 'Nhân viên cần đổi mật khẩu',
        role: UserRole.STAFF,
        storeId: store.id,
        passwordHash,
        status: UserStatus.MUST_CHANGE_PASSWORD,
        permissions: ['view_scan', 'view_profile']
      }
    })
  ]);

  await Promise.all(
    ['kg', 'lít'].map((unit) =>
      prisma.ingredientUnit.upsert({
        where: { normalizedName: normalizeUnit(unit) },
        update: { name: unit },
        create: {
          name: unit,
          normalizedName: normalizeUnit(unit)
        }
      })
    )
  );

  const defaultIngredientGroup = await prisma.ingredientGroup.upsert({
    where: { normalizedName: normalizeGroupName('Chưa phân loại') },
    update: { name: 'Chưa phân loại' },
    create: {
      name: 'Chưa phân loại',
      normalizedName: normalizeGroupName('Chưa phân loại')
    }
  });

  /* const [tea, milk, sugar] = await Promise.all([
    prisma.ingredient.upsert({
      where: { code: 'TEA-LEAF' },
      update: { name: 'Trà lá', unit: 'kg', isActive: true },
      create: { code: 'TEA-LEAF', name: 'Trà lá', unit: 'kg', isActive: true }
    }),
    prisma.ingredient.upsert({
      where: { code: 'MILK' },
      update: { name: 'Sữa tươi', unit: 'lít', isActive: true },
      create: { code: 'MILK', name: 'Sữa tươi', unit: 'lít', isActive: true }
    }),
    prisma.ingredient.upsert({
      where: { code: 'SUGAR' },
      update: { name: 'Nước đường', unit: 'lít', isActive: true },
      create: { code: 'SUGAR', name: 'Nước đường', unit: 'lít', isActive: true }
    })
  ]); */

  const [tea, milk, sugar] = await Promise.all([
    prisma.ingredient.upsert(buildIngredientUpsertPayload('TEA-LEAF', 'Trà lá', 'kg', defaultIngredientGroup.id)),
    prisma.ingredient.upsert(buildIngredientUpsertPayload('MILK', 'Sữa tươi', 'lít', defaultIngredientGroup.id)),
    prisma.ingredient.upsert(buildIngredientUpsertPayload('SUGAR', 'Nước đường', 'lít', defaultIngredientGroup.id))
  ]);

  const batchTeaOld = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {
        storeId: store.id,
        batchCode: 'BATCH-TRA-001'
      }
    },
    update: {
      ingredientId: tea.id,
      receivedAt: new Date('2026-04-01T02:00:00.000Z'),
      expiredAt: new Date('2026-05-01T02:00:00.000Z'),
      initialQty: 20,
      remainingQty: 19.9,
      status: BatchStatus.ACTIVE,
      qrCodeValue: batchQr('BATCH-TRA-001'),
      qrGeneratedAt: new Date(),
      labelCreatedAt: new Date()
    },
    create: {
      ingredientId: tea.id,
      storeId: store.id,
      batchCode: 'BATCH-TRA-001',
      receivedAt: new Date('2026-04-01T02:00:00.000Z'),
      expiredAt: new Date('2026-05-01T02:00:00.000Z'),
      initialQty: 20,
      remainingQty: 19.9,
      status: BatchStatus.ACTIVE,
      qrCodeValue: batchQr('BATCH-TRA-001'),
      qrGeneratedAt: new Date(),
      labelCreatedAt: new Date()
    }
  });

  const batchTeaNew = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {
        storeId: store.id,
        batchCode: 'BATCH-TRA-002'
      }
    },
    update: {
      ingredientId: tea.id,
      receivedAt: new Date('2026-04-04T02:00:00.000Z'),
      expiredAt: new Date('2026-05-05T02:00:00.000Z'),
      initialQty: 50,
      remainingQty: 54.8,
      status: BatchStatus.ACTIVE,
      qrCodeValue: batchQr('BATCH-TRA-002'),
      qrGeneratedAt: new Date()
    },
    create: {
      ingredientId: tea.id,
      storeId: store.id,
      batchCode: 'BATCH-TRA-002',
      receivedAt: new Date('2026-04-04T02:00:00.000Z'),
      expiredAt: new Date('2026-05-05T02:00:00.000Z'),
      initialQty: 50,
      remainingQty: 54.8,
      status: BatchStatus.ACTIVE,
      qrCodeValue: batchQr('BATCH-TRA-002'),
      qrGeneratedAt: new Date()
    }
  });

  const batchMilkLock = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {
        storeId: store.id,
        batchCode: 'BATCH-SUA-LOCK-001'
      }
    },
    update: {
      ingredientId: milk.id,
      receivedAt: new Date('2026-04-03T02:00:00.000Z'),
      expiredAt: new Date('2026-04-20T02:00:00.000Z'),
      initialQty: 30,
      remainingQty: 30,
      status: BatchStatus.SOFT_LOCKED,
      softLockReason: 'Bao bì bị hỏng',
      qrCodeValue: batchQr('BATCH-SUA-LOCK-001'),
      qrGeneratedAt: new Date()
    },
    create: {
      ingredientId: milk.id,
      storeId: store.id,
      batchCode: 'BATCH-SUA-LOCK-001',
      receivedAt: new Date('2026-04-03T02:00:00.000Z'),
      expiredAt: new Date('2026-04-20T02:00:00.000Z'),
      initialQty: 30,
      remainingQty: 30,
      status: BatchStatus.SOFT_LOCKED,
      softLockReason: 'Bao bì bị hỏng',
      qrCodeValue: batchQr('BATCH-SUA-LOCK-001'),
      qrGeneratedAt: new Date()
    }
  });

  const batchSugarExpired = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {
        storeId: store.id,
        batchCode: 'BATCH-DUONG-EXP-001'
      }
    },
    update: {
      ingredientId: sugar.id,
      receivedAt: new Date('2026-03-28T02:00:00.000Z'),
      expiredAt: new Date('2026-04-05T02:00:00.000Z'),
      initialQty: 15,
      remainingQty: 15,
      status: BatchStatus.EXPIRED,
      qrCodeValue: batchQr('BATCH-DUONG-EXP-001'),
      qrGeneratedAt: new Date()
    },
    create: {
      ingredientId: sugar.id,
      storeId: store.id,
      batchCode: 'BATCH-DUONG-EXP-001',
      receivedAt: new Date('2026-03-28T02:00:00.000Z'),
      expiredAt: new Date('2026-04-05T02:00:00.000Z'),
      initialQty: 15,
      remainingQty: 15,
      status: BatchStatus.EXPIRED,
      qrCodeValue: batchQr('BATCH-DUONG-EXP-001'),
      qrGeneratedAt: new Date()
    }
  });

  const batchSugarDepleted = await prisma.ingredientBatch.upsert({
    where: {
      storeId_batchCode: {
        storeId: store.id,
        batchCode: 'BATCH-DUONG-DEP-001'
      }
    },
    update: {
      ingredientId: sugar.id,
      receivedAt: new Date('2026-03-27T02:00:00.000Z'),
      expiredAt: new Date('2026-04-25T02:00:00.000Z'),
      initialQty: 12,
      remainingQty: 0,
      status: BatchStatus.DEPLETED,
      qrCodeValue: batchQr('BATCH-DUONG-DEP-001'),
      qrGeneratedAt: new Date()
    },
    create: {
      ingredientId: sugar.id,
      storeId: store.id,
      batchCode: 'BATCH-DUONG-DEP-001',
      receivedAt: new Date('2026-03-27T02:00:00.000Z'),
      expiredAt: new Date('2026-04-25T02:00:00.000Z'),
      initialQty: 12,
      remainingQty: 0,
      status: BatchStatus.DEPLETED,
      qrCodeValue: batchQr('BATCH-DUONG-DEP-001'),
      qrGeneratedAt: new Date()
    }
  });

  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {
      allowFifoBypass: true,
      anomalyThreshold: 0.7
    },
    create: {
      id: 'default',
      allowFifoBypass: true,
      anomalyThreshold: 0.7
    }
  });

  const whitelistValues = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '172.17.0.1',
    '172.18.0.1',
    '::ffff:172.17.0.1',
    '::ffff:172.18.0.1'
  ];
  for (const value of whitelistValues) {
    await prisma.storeNetworkWhitelist.upsert({
      where: {
        storeId_type_value: {
          storeId: store.id,
          type: 'IP',
          value
        }
      },
      update: {
        isActive: true
      },
      create: {
        storeId: store.id,
        type: 'IP',
        value,
        isActive: true
      }
    });
  }

  await prisma.storeNetworkWhitelist.upsert({
    where: {
      storeId_type_value: {
        storeId: store.id,
        type: 'SSID',
        value: 'FNB-DEMO-WIFI'
      }
    },
    update: { isActive: true },
    create: {
      storeId: store.id,
      type: 'SSID',
      value: 'FNB-DEMO-WIFI',
      isActive: true
    }
  });

  const milkTea = await prisma.posProduct.upsert({
    where: { code: 'MILK-TEA' },
    update: { name: 'Trà sữa', isActive: true },
    create: { code: 'MILK-TEA', name: 'Trà sữa', isActive: true }
  });
  const blackTea = await prisma.posProduct.upsert({
    where: { code: 'BLACK-TEA' },
    update: { name: 'Trà đen', isActive: true },
    create: { code: 'BLACK-TEA', name: 'Trà đen', isActive: true }
  });

  const recipeEntries = [
    { productId: milkTea.id, ingredientId: tea.id, qtyPerUnit: 0.05 },
    { productId: milkTea.id, ingredientId: milk.id, qtyPerUnit: 0.1 },
    { productId: milkTea.id, ingredientId: sugar.id, qtyPerUnit: 0.02 },
    { productId: blackTea.id, ingredientId: tea.id, qtyPerUnit: 0.04 },
    { productId: blackTea.id, ingredientId: sugar.id, qtyPerUnit: 0.01 }
  ];

  for (const entry of recipeEntries) {
    await prisma.recipe.upsert({
      where: {
        productId_ingredientId: {
          productId: entry.productId,
          ingredientId: entry.ingredientId
        }
      },
      update: {
        qtyPerUnit: entry.qtyPerUnit
      },
      create: entry
    });
  }

  await prisma.posSale.upsert({
    where: {
      storeId_productId_businessDate: {
        storeId: store.id,
        productId: milkTea.id,
        businessDate: businessDateValue
      }
    },
    update: { qtySold: 20 },
    create: {
      storeId: store.id,
      productId: milkTea.id,
      businessDate: businessDateValue,
      qtySold: 20
    }
  });
  await prisma.posSale.upsert({
    where: {
      storeId_productId_businessDate: {
        storeId: store.id,
        productId: blackTea.id,
        businessDate: businessDateValue
      }
    },
    update: { qtySold: 10 },
    create: {
      storeId: store.id,
      productId: blackTea.id,
      businessDate: businessDateValue,
      qtySold: 10
    }
  });

  await prisma.stockAdjustment.upsert({
    where: {
      id: 'stock-adjustment-sample'
    },
    update: {
      quantity: 5,
      reason: 'Điều chỉnh tồn đầu kỳ'
    },
    create: {
      id: 'stock-adjustment-sample',
      storeId: store.id,
      batchId: batchTeaNew.id,
      adjustmentType: StockAdjustmentType.INCREASE,
      quantity: 5,
      reason: 'Điều chỉnh tồn đầu kỳ',
      createdByUserId: admin.id
    }
  });

  await prisma.scanLog.upsert({
    where: {
      clientEventId: '11111111-1111-4111-8111-111111111111'
    },
    update: {
      resultStatus: ScanResultStatus.SUCCESS,
      resultCode: 'SCAN_OK',
      message: 'Bản ghi quét thành công mẫu'
    },
    create: {
      clientEventId: '11111111-1111-4111-8111-111111111111',
      storeId: store.id,
      userId: staff1.id,
      deviceId: 'demo-device-1',
      batchId: batchTeaOld.id,
      quantityUsed: 0.1,
      scannedAt: new Date(`${businessDate}T02:00:00.000Z`),
      receivedAt: new Date(`${businessDate}T02:00:05.000Z`),
      source: ScanSource.ONLINE,
      entryMethod: ScanEntryMethod.CAMERA,
      ipAddress: '127.0.0.1',
      resultStatus: ScanResultStatus.SUCCESS,
      resultCode: 'SCAN_OK',
      message: 'Bản ghi quét thành công mẫu'
    }
  });

  await prisma.scanLog.upsert({
    where: {
      clientEventId: '22222222-2222-4222-8222-222222222222'
    },
    update: {
      resultStatus: ScanResultStatus.WARNING,
      resultCode: 'WARNING_FIFO',
      message: 'Bản ghi quét cảnh báo FIFO mẫu'
    },
    create: {
      clientEventId: '22222222-2222-4222-8222-222222222222',
      storeId: store.id,
      userId: staff1.id,
      deviceId: 'demo-device-1',
      batchId: batchTeaNew.id,
      quantityUsed: 0.2,
      scannedAt: new Date(`${businessDate}T03:00:00.000Z`),
      receivedAt: new Date(`${businessDate}T03:00:04.000Z`),
      source: ScanSource.MANUAL_ENTRY,
      entryMethod: ScanEntryMethod.MANUAL,
      ipAddress: '127.0.0.1',
      resultStatus: ScanResultStatus.WARNING,
      resultCode: 'WARNING_FIFO',
      message: 'Bản ghi quét cảnh báo FIFO mẫu'
    }
  });

  await prisma.scanLog.upsert({
    where: {
      clientEventId: '33333333-3333-4333-8333-333333333333'
    },
    update: {
      resultStatus: ScanResultStatus.ERROR,
      resultCode: 'ERROR_NETWORK_RESTRICTED',
      message: 'Bản ghi quét bị từ chối do mạng mẫu'
    },
    create: {
      clientEventId: '33333333-3333-4333-8333-333333333333',
      storeId: store.id,
      userId: staff1.id,
      deviceId: 'demo-device-2',
      batchId: null,
      quantityUsed: 0.5,
      scannedAt: new Date(`${businessDate}T04:00:00.000Z`),
      receivedAt: new Date(`${businessDate}T04:00:03.000Z`),
      source: ScanSource.ONLINE,
      entryMethod: ScanEntryMethod.CAMERA,
      ipAddress: '10.0.0.2',
      resultStatus: ScanResultStatus.ERROR,
      resultCode: 'ERROR_NETWORK_RESTRICTED',
      message: 'Bản ghi quét bị từ chối do mạng mẫu'
    }
  });

  const existingFraud = await prisma.fraudAttemptLog.findFirst({
    where: {
      OR: [
        { detail: 'Bản ghi mẫu: thiết bị dùng mạng không hợp lệ' },
        { detail: 'Seeded invalid network attempt' }
      ]
    }
  });
  if (existingFraud) {
    await prisma.fraudAttemptLog.update({
      where: { id: existingFraud.id },
      data: {
        storeId: store.id,
        userId: staff1.id,
        deviceId: 'demo-device-2',
        ipAddress: '10.0.0.2',
        attemptType: 'NETWORK_RESTRICTED',
        detail: 'Bản ghi mẫu: thiết bị dùng mạng không hợp lệ'
      }
    });
  } else {
    await prisma.fraudAttemptLog.create({
      data: {
        storeId: store.id,
        userId: staff1.id,
        deviceId: 'demo-device-2',
        ipAddress: '10.0.0.2',
        attemptType: 'NETWORK_RESTRICTED',
        detail: 'Bản ghi mẫu: thiết bị dùng mạng không hợp lệ'
      }
    });
  }

  await prisma.anomalyAlert.upsert({
    where: {
      storeId_businessDate_ingredientId: {
        storeId: store.id,
        businessDate: businessDateValue,
        ingredientId: milk.id
      }
    },
    update: {
      expectedQty: 2,
      actualQty: 0,
      ratio: 0,
      severity: AlertSeverity.HIGH,
      message: 'Mức sử dụng thực tế của Sữa tươi đang thấp hơn ngưỡng cảnh báo',
      status: AlertStatus.OPEN
    },
    create: {
      storeId: store.id,
      businessDate: businessDateValue,
      ingredientId: milk.id,
      expectedQty: 2,
      actualQty: 0,
      ratio: 0,
      severity: AlertSeverity.HIGH,
      message: 'Mức sử dụng thực tế của Sữa tươi đang thấp hơn ngưỡng cảnh báo',
      status: AlertStatus.OPEN
    }
  });

  const [scheduleYear, scheduleMonth] = businessDate.split('-').map((value, index) =>
    index < 2 ? Number(value) : value
  ) as [number, number, string];

  const workSchedule = await prisma.workSchedule.upsert({
    where: {
      storeId_year_month: {
        storeId: store.id,
        year: scheduleYear,
        month: scheduleMonth
      }
    },
    update: {
      title: `Bang cham cong thang ${String(scheduleMonth).padStart(2, '0')}/${scheduleYear} - Chi nhanh ${store.name}`,
      notes: 'T: Thu viec\nC: Chinh thuc',
      status: WorkScheduleStatus.DRAFT
    },
    create: {
      storeId: store.id,
      year: scheduleYear,
      month: scheduleMonth,
      title: `Bang cham cong thang ${String(scheduleMonth).padStart(2, '0')}/${scheduleYear} - Chi nhanh ${store.name}`,
      notes: 'T: Thu viec\nC: Chinh thuc',
      status: WorkScheduleStatus.DRAFT
    }
  });

  await prisma.workScheduleEntry.deleteMany({
    where: {
      workScheduleEmployee: {
        workScheduleId: workSchedule.id
      }
    }
  });
  await prisma.workScheduleEmployee.deleteMany({ where: { workScheduleId: workSchedule.id } });
  await prisma.workScheduleShift.deleteMany({ where: { workScheduleId: workSchedule.id } });

  const seededShifts = [
    { key: 'ca-1', code: 'CA1', name: 'Ca 1', startTime: '08:00', endTime: '13:00', durationHours: 5, sortOrder: 0 },
    { key: 'ca-2', code: 'CA2', name: 'Ca 2', startTime: '13:00', endTime: '18:00', durationHours: 5, sortOrder: 1 },
    { key: 'ca-3', code: 'CA3', name: 'Ca 3', startTime: '18:00', endTime: '24:00', durationHours: 6.5, sortOrder: 2 }
  ];

  const shiftMap = new Map<string, string>();
  for (const shift of seededShifts) {
    const createdShift = await prisma.workScheduleShift.create({
      data: {
        workScheduleId: workSchedule.id,
        ...shift
      }
    });
    shiftMap.set(shift.key, createdShift.id);
  }

  const managerScheduleRow = await prisma.workScheduleEmployee.create({
    data: {
      workScheduleId: workSchedule.id,
      userId: manager.id,
      displayName: manager.fullName,
      sortOrder: 0,
      trialHourlyRate: 28000,
      officialHourlyRate: 32000
    }
  });
  const staff1ScheduleRow = await prisma.workScheduleEmployee.create({
    data: {
      workScheduleId: workSchedule.id,
      userId: staff1.id,
      displayName: staff1.fullName,
      sortOrder: 1,
      trialHourlyRate: 18000,
      officialHourlyRate: 22000
    }
  });
  const staff2ScheduleRow = await prisma.workScheduleEmployee.create({
    data: {
      workScheduleId: workSchedule.id,
      userId: staff2.id,
      displayName: staff2.fullName,
      sortOrder: 2,
      trialHourlyRate: 18000,
      officialHourlyRate: 22000
    }
  });

  await prisma.workScheduleEntry.createMany({
    data: [
      { workScheduleEmployeeId: managerScheduleRow.id, shiftId: shiftMap.get('ca-1')!, day: 1, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: managerScheduleRow.id, shiftId: shiftMap.get('ca-2')!, day: 1, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: managerScheduleRow.id, shiftId: shiftMap.get('ca-1')!, day: 3, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: managerScheduleRow.id, shiftId: shiftMap.get('ca-2')!, day: 5, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: staff1ScheduleRow.id, shiftId: shiftMap.get('ca-1')!, day: 2, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: staff1ScheduleRow.id, shiftId: shiftMap.get('ca-3')!, day: 4, entryType: WorkEntryType.OFFICIAL },
      { workScheduleEmployeeId: staff1ScheduleRow.id, shiftId: shiftMap.get('ca-2')!, day: 6, entryType: WorkEntryType.TRIAL },
      { workScheduleEmployeeId: staff2ScheduleRow.id, shiftId: shiftMap.get('ca-2')!, day: 2, entryType: WorkEntryType.TRIAL },
      { workScheduleEmployeeId: staff2ScheduleRow.id, shiftId: shiftMap.get('ca-3')!, day: 3, entryType: WorkEntryType.TRIAL },
      { workScheduleEmployeeId: staff2ScheduleRow.id, shiftId: shiftMap.get('ca-1')!, day: 7, entryType: WorkEntryType.OFFICIAL }
    ]
  });

  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      action: 'SEED_INIT',
      entityType: 'System',
      entityId: 'bootstrap'
    }
  });
  if (!existingAudit) {
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'SEED_INIT',
        entityType: 'System',
        entityId: 'bootstrap',
        newData: { storeId: store.id }
      }
    });
  }

  console.log({
    store: store.code,
    users: [admin.username, manager.username, staff1.username, staff2.username],
    batches: [
      batchTeaOld.batchCode,
      batchTeaNew.batchCode,
      batchMilkLock.batchCode,
      batchSugarExpired.batchCode,
      batchSugarDepleted.batchCode
    ],
    businessDate
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
