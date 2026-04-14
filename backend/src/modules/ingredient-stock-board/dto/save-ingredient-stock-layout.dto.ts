import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { ScanOperationType } from '@prisma/client';

export class SaveIngredientStockLayoutItemDto {
  @ApiProperty()
  @IsString()
  ingredientId!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SaveIngredientStockLayoutGroupDto {
  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: [SaveIngredientStockLayoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveIngredientStockLayoutItemDto)
  items!: SaveIngredientStockLayoutItemDto[];
}

export class SaveIngredientStockLayoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({ enum: ScanOperationType, default: ScanOperationType.STORE_USAGE })
  @IsEnum(ScanOperationType)
  operationType!: ScanOperationType;

  @ApiProperty({ type: [SaveIngredientStockLayoutGroupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveIngredientStockLayoutGroupDto)
  groups!: SaveIngredientStockLayoutGroupDto[];
}
