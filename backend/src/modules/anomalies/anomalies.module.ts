import { Module } from '@nestjs/common';

import { AppConfigModule } from '../config/config.module';
import { PosModule } from '../pos/pos.module';
import { AnomaliesController } from './anomalies.controller';
import { AnomaliesService } from './anomalies.service';

@Module({
  imports: [PosModule, AppConfigModule],
  controllers: [AnomaliesController],
  providers: [AnomaliesService],
  exports: [AnomaliesService]
})
export class AnomaliesModule {}
