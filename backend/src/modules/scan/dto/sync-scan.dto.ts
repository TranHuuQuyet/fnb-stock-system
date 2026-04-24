import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { ScanDto } from './scan.dto';

export const MAX_SYNC_SCAN_EVENTS = 100;

export class SyncScanDto {
  @ApiProperty({ type: [ScanDto], minItems: 1, maxItems: MAX_SYNC_SCAN_EVENTS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SYNC_SCAN_EVENTS)
  @ValidateNested({ each: true })
  @Type(() => ScanDto)
  events!: ScanDto[];
}
