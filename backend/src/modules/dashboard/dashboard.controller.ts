import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getSummary(
    @CurrentUser() user: JwtUser,
    @Query('storeId') storeId: string | undefined,
    @Query('businessDate') businessDate: string
  ) {
    return {
      data: await this.dashboardService.getSummary(user, storeId, businessDate)
    };
  }
}
