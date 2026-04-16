import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength
} from 'class-validator';

import { PERMISSION_VALUES } from '../../../common/constants/permissions';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from '../../../common/utils/password';

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
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  temporaryPassword!: string;

  @ApiProperty({ required: false, type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsIn(PERMISSION_VALUES, { each: true })
  @IsString({ each: true })
  permissions?: string[];
}
