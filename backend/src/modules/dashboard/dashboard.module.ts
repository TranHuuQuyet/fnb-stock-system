import { Module } from '@nestjs/common';

import { AnomaliesModule } from '../anomalies/anomalies.module';
import { PosModule } from '../pos/pos.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PosModule, AnomaliesModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
