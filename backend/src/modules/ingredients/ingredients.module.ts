import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [AuditModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService]
})
export class IngredientsModule {}
