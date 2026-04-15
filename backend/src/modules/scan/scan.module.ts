import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BatchesModule } from '../batches/batches.module';
import { AppConfigModule } from '../config/config.module';
import { DevicesModule } from '../devices/devices.module';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [DevicesModule, AppConfigModule, BatchesModule, AuditModule],
  controllers: [ScanController, TransfersController],
  providers: [ScanService, TransfersService],
  exports: [ScanService, TransfersService]
})
export class ScanModule {}
