import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockTransferStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const TRANSFER_DIRECTIONS = ['ALL', 'INCOMING', 'OUTGOING'] as const;
export type TransferDirection = (typeof TRANSFER_DIRECTIONS)[number];

export class QueryTransfersDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchCode?: string;

  @ApiPropertyOptional({ enum: StockTransferStatus })
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @ApiPropertyOptional({ enum: TRANSFER_DIRECTIONS })
  @IsOptional()
  @IsIn(TRANSFER_DIRECTIONS)
  direction?: TransferDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
