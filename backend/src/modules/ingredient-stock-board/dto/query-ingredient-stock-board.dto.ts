import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ScanOperationType } from '@prisma/client';

export class QueryIngredientStockBoardDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ enum: ScanOperationType, default: ScanOperationType.STORE_USAGE })
  @IsOptional()
  @IsEnum(ScanOperationType)
  operationType: ScanOperationType = ScanOperationType.STORE_USAGE;
}
