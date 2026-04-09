import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BatchStatus } from '@prisma/client';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryBatchesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  ingredientId?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;
}
