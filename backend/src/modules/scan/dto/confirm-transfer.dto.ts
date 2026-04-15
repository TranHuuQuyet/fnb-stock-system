import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmTransferDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
