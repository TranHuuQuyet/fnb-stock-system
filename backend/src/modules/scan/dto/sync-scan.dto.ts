import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { ScanDto } from './scan.dto';

export class SyncScanDto {
  @ApiProperty({ type: [ScanDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanDto)
  events!: ScanDto[];
}
