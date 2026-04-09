import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [AuditModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [StockAdjustmentsService]
})
export class StockAdjustmentsModule {}
