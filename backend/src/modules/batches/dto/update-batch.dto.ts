import { ApiPropertyOptional } from '@nestjs/swagger';
import { BatchStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class UpdateBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiredAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingQty?: number;

  @ApiPropertyOptional({ enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  softLockReason?: string | null;
}
