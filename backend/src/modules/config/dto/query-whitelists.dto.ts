import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NetworkWhitelistType } from '@prisma/client';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryWhitelistsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsEnum(NetworkWhitelistType)
  type?: NetworkWhitelistType;
}
