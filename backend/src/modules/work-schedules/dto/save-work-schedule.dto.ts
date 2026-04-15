import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { WorkEntryType, WorkScheduleStatus } from '@prisma/client';

const SHIFT_TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class SaveWorkScheduleEntryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day!: number;

  @ApiProperty()
  @IsString()
  shiftKey!: string;

  @ApiProperty({ enum: WorkEntryType })
  @IsEnum(WorkEntryType)
  entryType!: WorkEntryType;
}

export class SaveWorkScheduleEmployeeDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trialHourlyRate!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  officialHourlyRate!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowanceAmount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  lateMinutes?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  earlyLeaveMinutes?: number;

  @ApiProperty({ type: [SaveWorkScheduleEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkScheduleEntryDto)
  entries!: SaveWorkScheduleEntryDto[];
}

export class SaveWorkScheduleShiftDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @Matches(SHIFT_TIME_PATTERN)
  startTime!: string;

  @ApiProperty()
  @Matches(SHIFT_TIME_PATTERN)
  endTime!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationHours!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SaveWorkScheduleDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: WorkScheduleStatus })
  @IsOptional()
  @IsEnum(WorkScheduleStatus)
  status?: WorkScheduleStatus;

  @ApiProperty({ type: [SaveWorkScheduleShiftDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveWorkScheduleShiftDto)
  shifts!: SaveWorkScheduleShiftDto[];

  @ApiProperty({ type: [SaveWorkScheduleEmployeeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkScheduleEmployeeDto)
  employees!: SaveWorkScheduleEmployeeDto[];
}
