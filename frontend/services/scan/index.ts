import { apiClient, unwrapData } from '@/lib/api-client';

type ScanNetworkStatusResponse = {
  storeId: string;
  ipAddress: string;
  normalizedIpAddress: string;
  hasActiveWhitelist: boolean;
  isAllowedByWhitelist: boolean;
  matchedWhitelistTypes: Array<'IP' | 'SSID'>;
  bypassEnabled: boolean;
  bypassActive: boolean;
  bypassExpiresAt: string | null;
  bypassReason: string | null;
  canAccessBusinessOperations: boolean;
};

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

export const getScanNetworkStatus = (query = '') =>
  unwrapData<ScanNetworkStatusResponse>(apiClient(`/scan/network-status${query}`));

export const listScanLogs = (query = '') => apiClient(`/scan/logs${query}`);
