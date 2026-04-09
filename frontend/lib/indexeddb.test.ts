import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteOfflineScan,
  getAllOfflineScans,
  queueOfflineScan,
  updateOfflineScanStatus
} from './indexeddb';

describe('offline scan queue', () => {
  beforeEach(async () => {
    const scans = await getAllOfflineScans();
    await Promise.all(scans.map((item) => deleteOfflineScan(item.clientEventId)));
  });

  it('stores and updates queued scan events', async () => {
    await queueOfflineScan({
      clientEventId: 'event-1',
      batchCode: 'BATCH-TRA-001',
      quantityUsed: 0.1,
      scannedAt: new Date().toISOString(),
      deviceId: 'device-1',
      entryMethod: 'CAMERA',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    let scans = await getAllOfflineScans();
    expect(scans).toHaveLength(1);
    expect(scans[0]?.status).toBe('pending');

    await updateOfflineScanStatus('event-1', 'failed', 'Network failed');
    scans = await getAllOfflineScans();

    expect(scans[0]?.status).toBe('failed');
    expect(scans[0]?.errorMessage).toBe('Network failed');
  });
});
