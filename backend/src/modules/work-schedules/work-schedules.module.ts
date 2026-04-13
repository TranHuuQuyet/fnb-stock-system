import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WorkSchedulesController } from './work-schedules.controller';
import { WorkSchedulesService } from './work-schedules.service';

@Module({
  imports: [AuditModule],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService]
})
export class WorkSchedulesModule {}
