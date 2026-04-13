import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { QueryWorkScheduleDto } from './dto/query-work-schedule.dto';
import { SaveWorkScheduleDto } from './dto/save-work-schedule.dto';
import { WorkSchedulesService } from './work-schedules.service';

@ApiTags('Work Schedules')
@ApiBearerAuth()
@Controller('work-schedules')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class WorkSchedulesController {
  constructor(private readonly workSchedulesService: WorkSchedulesService) {}

  @Get()
  async getSchedule(@CurrentUser() user: JwtUser, @Query() query: QueryWorkScheduleDto) {
    return {
      data: await this.workSchedulesService.getSchedule(user, query)
    };
  }

  @Put()
  @Roles(UserRole.ADMIN)
  async saveSchedule(@CurrentUser() user: JwtUser, @Body() dto: SaveWorkScheduleDto) {
    return {
      data: await this.workSchedulesService.saveSchedule(user, dto),
      message: 'Cập nhật bảng chấm công thành công'
    };
  }
}
