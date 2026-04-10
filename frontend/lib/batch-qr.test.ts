import { describe, expect, it } from 'vitest';

import { buildIssuedLabelQrValue, parseBatchQrValue } from './batch-qr';

describe('batch QR helpers', () => {
  it('builds a distinct QR payload for each issued label', () => {
    expect(
      buildIssuedLabelQrValue({
        batchId: 'batch-1',
        batchCode: 'MILK-001',
        sequenceNumber: 7
      })
    ).toBe('FNBBATCH:MILK-001|BATCH:batch-1|SEQ:7');
  });

  it('parses the new label QR format and keeps the batch code intact', () => {
    expect(parseBatchQrValue('FNBBATCH:MILK-001|BATCH:batch-1|SEQ:12')).toEqual({
      batchCode: 'MILK-001',
      batchId: 'batch-1',
      sequenceNumber: 12,
      rawValue: 'FNBBATCH:MILK-001|BATCH:batch-1|SEQ:12'
    });
  });

  it('keeps supporting the legacy QR format for older labels', () => {
    expect(parseBatchQrValue('FNBBATCH:MILK-001')).toEqual({
      batchCode: 'MILK-001',
      batchId: null,
      sequenceNumber: null,
      rawValue: 'FNBBATCH:MILK-001'
    });
  });
});
