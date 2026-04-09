import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigModule } from '../config/config.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [AuditModule, AppConfigModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService]
})
export class PosModule {}
