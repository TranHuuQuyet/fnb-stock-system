import { ApiProperty } from '@nestjs/swagger';
import { StockAdjustmentType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString
} from 'class-validator';

export class CreateStockAdjustmentDto {
  @ApiProperty({ enum: StockAdjustmentType })
  @IsEnum(StockAdjustmentType)
  adjustmentType!: StockAdjustmentType;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
