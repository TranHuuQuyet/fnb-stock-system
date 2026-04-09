import { apiClient, unwrapData } from '@/lib/api-client';

export const submitScan = (payload: unknown) =>
  unwrapData(
    apiClient('/scan', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const submitManualScan = (payload: unknown) =>
  unwrapData(
    apiClient('/scan/manual', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const listScanLogs = (query = '') => apiClient(`/scan/logs${query}`);
