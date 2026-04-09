import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Module({
  imports: [AuditModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService]
})
export class AppConfigModule {}
