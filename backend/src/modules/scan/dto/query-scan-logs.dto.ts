import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ScanResultStatus } from '@prisma/client';

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
}
