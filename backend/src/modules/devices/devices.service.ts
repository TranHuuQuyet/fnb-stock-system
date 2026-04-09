import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(params: { deviceId: string; storeId: string; userId?: string | null }) {
    return this.prisma.device.upsert({
      where: {
        deviceId: params.deviceId
      },
      create: {
        deviceId: params.deviceId,
        storeId: params.storeId,
        userId: params.userId ?? null
      },
      update: {
        storeId: params.storeId,
        userId: params.userId ?? null,
        lastSeenAt: new Date()
      }
    });
  }
}
