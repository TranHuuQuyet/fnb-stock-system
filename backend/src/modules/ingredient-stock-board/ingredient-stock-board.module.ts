import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { IngredientStockBoardController } from './ingredient-stock-board.controller';
import { IngredientStockBoardService } from './ingredient-stock-board.service';

@Module({
  imports: [AuditModule],
  controllers: [IngredientStockBoardController],
  providers: [IngredientStockBoardService]
})
export class IngredientStockBoardModule {}
