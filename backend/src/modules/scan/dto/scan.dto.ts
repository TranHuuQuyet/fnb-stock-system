import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanEntryMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
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

  @ApiPropertyOptional({ enum: ScanEntryMethod, default: ScanEntryMethod.CAMERA })
  @IsOptional()
  @IsEnum(ScanEntryMethod)
  entryMethod?: ScanEntryMethod;
}
