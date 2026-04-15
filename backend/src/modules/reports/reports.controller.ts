import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { QueryAdminReportsDto } from './dto/query-admin-reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@Controller('admin/reports')
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getOverview(@CurrentUser() user: JwtUser, @Query() query: QueryAdminReportsDto) {
    return {
      data: await this.reportsService.getAdminOverview(user, query)
    };
  }
}
