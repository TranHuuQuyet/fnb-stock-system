import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ScanOperationType, ScanResultStatus } from '@prisma/client';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryScanLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  batchCode?: string;

  @IsOptional()
  @IsEnum(ScanResultStatus)
  resultStatus?: ScanResultStatus;

  @IsOptional()
  @IsEnum(ScanOperationType)
  operationType?: ScanOperationType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
