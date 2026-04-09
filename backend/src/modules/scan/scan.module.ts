import { Module } from '@nestjs/common';

import { BatchesModule } from '../batches/batches.module';
import { AppConfigModule } from '../config/config.module';
import { DevicesModule } from '../devices/devices.module';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [DevicesModule, AppConfigModule, BatchesModule],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService]
})
export class ScanModule {}
