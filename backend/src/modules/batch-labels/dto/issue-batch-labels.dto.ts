import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class IssueBatchLabelsDto {
  @ApiProperty({ minimum: 1, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ required: false, example: 'In bo sung do tem cu bi hong khi dan len ke' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
