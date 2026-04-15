import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';

import { PERMISSION_VALUES } from '../../../common/constants/permissions';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  temporaryPassword!: string;

  @ApiProperty({ required: false, type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsIn(PERMISSION_VALUES, { each: true })
  @IsString({ each: true })
  permissions?: string[];
}
