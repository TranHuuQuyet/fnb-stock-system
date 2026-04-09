import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryIngredientsDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true'))
  @IsBoolean()
  isActive?: boolean;
}
