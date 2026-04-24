import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanEntryMethod, ScanOperationType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID
} from 'class-validator';

export class ScanDto {
  @ApiProperty()
  @IsString()
  batchCode!: string;

  @ApiProperty()
  @IsNumber()
  @IsInt()
  @IsPositive()
  quantityUsed!: number;

  @ApiProperty()
  @IsDateString()
  scannedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty()
  @IsUUID()
  clientEventId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ssid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ enum: ScanOperationType, default: ScanOperationType.STORE_USAGE })
  @IsOptional()
  @IsEnum(ScanOperationType)
  operationType?: ScanOperationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationStoreId?: string;

  @ApiPropertyOptional({ enum: ScanEntryMethod, default: ScanEntryMethod.CAMERA })
  @IsOptional()
  @IsEnum(ScanEntryMethod)
  entryMethod?: ScanEntryMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scannedLabelValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scannedLabelBatchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  scannedLabelSequenceNumber?: number;
}
