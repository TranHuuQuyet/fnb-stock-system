import { apiClient, unwrapData } from '@/lib/api-client';

export const listBatches = (query = '') => apiClient(`/admin/batches${query}`);
export const listAccessibleBatches = (query = '') => apiClient(`/batches${query}`);

export const createBatch = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/batches', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const updateBatch = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/batches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const softLockBatch = (id: string, reason: string) =>
  unwrapData(
    apiClient(`/admin/batches/${id}/soft-lock`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  );

export const unlockBatch = (id: string) =>
  unwrapData(
    apiClient(`/admin/batches/${id}/unlock`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  );

export const generateBatchQr = (id: string) =>
  unwrapData(
    apiClient(`/admin/batches/${id}/generate-qr`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  );

export const getBatchQr = (id: string) => unwrapData(apiClient(`/admin/batches/${id}/qr`));
export const getBatchLabel = (id: string) =>
  unwrapData(apiClient(`/admin/batches/${id}/label`));
export const issueBatchLabels = (id: string, payload: { quantity: number }) =>
  unwrapData(
    apiClient(`/admin/batches/${id}/labels/issue`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const createAdjustment = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/batches/${id}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const listAdjustments = (id: string) =>
  unwrapData(apiClient(`/admin/batches/${id}/adjustments`));
