import { ApiProperty } from '@nestjs/swagger';
import { NetworkWhitelistType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateWhitelistDto {
  @ApiProperty()
  @IsString()
  storeId!: string;

  @ApiProperty({ enum: NetworkWhitelistType })
  @IsEnum(NetworkWhitelistType)
  type!: NetworkWhitelistType;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
