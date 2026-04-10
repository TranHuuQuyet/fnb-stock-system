import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class IssueBatchLabelsDto {
  @ApiProperty({ minimum: 1, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
