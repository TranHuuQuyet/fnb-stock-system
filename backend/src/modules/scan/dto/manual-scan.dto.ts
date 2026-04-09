import { ScanEntryMethod } from '@prisma/client';

import { ScanDto } from './scan.dto';

export class ManualScanDto extends ScanDto {
  entryMethod: ScanEntryMethod = ScanEntryMethod.MANUAL;
}
