import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { StoresAccessController } from './stores-access.controller';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuditModule],
  controllers: [StoresController, StoresAccessController],
  providers: [StoresService],
  exports: [StoresService]
})
export class StoresModule {}
