import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty()
  @IsString()
  ingredientId!: string;

  @ApiProperty()
  @IsString()
  storeId!: string;

  @ApiProperty()
  @IsString()
  batchCode!: string;

  @ApiProperty()
  @IsDateString()
  receivedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiredAt?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  initialQty!: number;

  @ApiPropertyOptional({ enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;
}
