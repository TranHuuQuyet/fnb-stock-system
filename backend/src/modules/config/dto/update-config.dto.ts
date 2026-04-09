import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowFifoBypass?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anomalyThreshold?: number;
}
