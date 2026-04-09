import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { AnomaliesService } from './anomalies.service';

@ApiTags('Anomalies')
@ApiBearerAuth()
@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Post('run')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async run(
    @CurrentUser() user: JwtUser,
    @Query('storeId') storeId: string,
    @Query('businessDate') businessDate: string
  ) {
    return {
      data: await this.anomaliesService.run(user, storeId, businessDate),
      message: 'Anomaly detection completed'
    };
  }

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async recent(@CurrentUser() user: JwtUser, @Query('storeId') storeId?: string) {
    return {
      data: await this.anomaliesService.recent(user, storeId)
    };
  }
}
