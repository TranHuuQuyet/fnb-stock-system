import { apiClient, unwrapData } from '@/lib/api-client';

export const getConfig = () => unwrapData(apiClient('/admin/config'));
export const updateConfig = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const listWhitelists = (query = '') => apiClient(`/admin/network-whitelists${query}`);
export const createWhitelist = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/network-whitelists', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );
export const updateWhitelist = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/network-whitelists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );
export const deleteWhitelist = (id: string) =>
  unwrapData(
    apiClient(`/admin/network-whitelists/${id}`, {
      method: 'DELETE'
    })
  );

export const listNetworkBypasses = () => apiClient('/admin/network-bypasses');
export const updateNetworkBypass = (
  storeId: string,
  payload: {
    enabled: boolean;
    expiresAt?: string | null;
    reason?: string | null;
  }
) =>
  unwrapData(
    apiClient(`/admin/network-bypasses/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const listAuditLogs = (query = '') => apiClient(`/admin/audit-logs${query}`);
