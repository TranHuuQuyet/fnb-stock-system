import { ApiPropertyOptional } from '@nestjs/swagger';
import { NetworkWhitelistType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateWhitelistDto {
  @ApiPropertyOptional({ enum: NetworkWhitelistType })
  @IsOptional()
  @IsEnum(NetworkWhitelistType)
  type?: NetworkWhitelistType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
