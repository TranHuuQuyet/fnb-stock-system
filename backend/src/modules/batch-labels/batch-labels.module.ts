import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BatchesModule } from '../batches/batches.module';
import { BatchLabelsController } from './batch-labels.controller';
import { BatchLabelsService } from './batch-labels.service';

@Module({
  imports: [BatchesModule, AuditModule],
  controllers: [BatchLabelsController],
  providers: [BatchLabelsService],
  exports: [BatchLabelsService]
})
export class BatchLabelsModule {}
