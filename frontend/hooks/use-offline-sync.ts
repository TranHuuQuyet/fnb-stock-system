"use client";

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import {
  deleteOfflineScan,
  getScansByStatus,
  resetSyncingScans,
  updateOfflineScanStatus
} from '@/lib/indexeddb';
import { useNetworkStatus } from './use-network-status';

export type SyncState = 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'SYNC_ERROR';

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus();
  const [state, setState] = useState<SyncState>(isOnline ? 'SYNCED' : 'OFFLINE');

  useEffect(() => {
    resetSyncingScans().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setState('OFFLINE');
      return;
    }

    const syncPending = async () => {
      const pending = await getScansByStatus(['pending', 'failed']);
      if (pending.length === 0) {
        setState('SYNCED');
        return;
      }

      setState('SYNCING');
      try {
        await Promise.all(
          pending.map((item) => updateOfflineScanStatus(item.clientEventId, 'syncing'))
        );

        const response = await apiClient<{
          data: Array<{
            clientEventId: string;
            duplicated: boolean;
            resultStatus: 'SUCCESS' | 'WARNING' | 'ERROR';
            message: string;
          }>;
          synced: number;
          failed: number;
        }>('/scan/sync', {
          method: 'POST',
          body: JSON.stringify({
            events: pending.map(({ status, errorMessage, createdAt, ...event }) => event)
          })
        });

        for (const result of response.data.data) {
          if (result.resultStatus === 'ERROR') {
            await updateOfflineScanStatus(
              result.clientEventId,
              'failed',
              result.message
            );
            continue;
          }

          await updateOfflineScanStatus(result.clientEventId, 'synced');
          await deleteOfflineScan(result.clientEventId);
        }

        setState(response.data.failed > 0 ? 'SYNC_ERROR' : 'SYNCED');
      } catch (error) {
        const pendingAgain = await getScansByStatus(['syncing']);
        await Promise.all(
          pendingAgain.map((item) =>
            updateOfflineScanStatus(item.clientEventId, 'failed', 'Đồng bộ thất bại')
          )
        );
        setState('SYNC_ERROR');
      }
    };

    void syncPending();
  }, [isOnline]);

  return {
    syncState: state,
    isOnline
  };
}
