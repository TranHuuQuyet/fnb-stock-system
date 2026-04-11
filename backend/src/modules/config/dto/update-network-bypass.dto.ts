import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateNetworkBypassDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Thời điểm hết hiệu lực của bypass, ISO-8601'
  })
  @ValidateIf((dto) => dto.enabled === true)
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string | null;
}
