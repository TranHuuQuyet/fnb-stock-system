"use client";

import { DBSchema, openDB } from 'idb';

export type OfflineScanStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type OfflineScanEvent = {
  clientEventId: string;
  batchCode: string;
  quantityUsed: number;
  scannedAt: string;
  deviceId: string;
  ssid?: string;
  storeId?: string;
  entryMethod: 'CAMERA' | 'MANUAL';
  status: OfflineScanStatus;
  errorMessage?: string;
  createdAt: string;
};

interface FnbScanDb extends DBSchema {
  scans: {
    key: string;
    value: OfflineScanEvent;
    indexes: {
      'by-status': OfflineScanStatus;
    };
  };
}

const getDb = () =>
  openDB<FnbScanDb>('fnb-stock-db', 1, {
    upgrade(db) {
      const store = db.createObjectStore('scans', {
        keyPath: 'clientEventId'
      });
      store.createIndex('by-status', 'status');
    }
  });

export const queueOfflineScan = async (event: OfflineScanEvent) => {
  const db = await getDb();
  await db.put('scans', event);
};

export const getScansByStatus = async (statuses: OfflineScanStatus[]) => {
  const db = await getDb();
  const all = await db.getAll('scans');
  return all.filter((item) => statuses.includes(item.status));
};

export const updateOfflineScanStatus = async (
  clientEventId: string,
  status: OfflineScanStatus,
  errorMessage?: string
) => {
  const db = await getDb();
  const existing = await db.get('scans', clientEventId);
  if (!existing) {
    return;
  }

  await db.put('scans', {
    ...existing,
    status,
    errorMessage
  });
};

export const deleteOfflineScan = async (clientEventId: string) => {
  const db = await getDb();
  await db.delete('scans', clientEventId);
};

export const getAllOfflineScans = async () => {
  const db = await getDb();
  return db.getAll('scans');
};

export const resetSyncingScans = async () => {
  const syncingItems = await getScansByStatus(['syncing']);
  await Promise.all(
    syncingItems.map((item) => updateOfflineScanStatus(item.clientEventId, 'pending'))
  );
};
