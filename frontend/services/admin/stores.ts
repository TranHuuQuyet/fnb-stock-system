import { apiClient, unwrapData } from '@/lib/api-client';

export const listStores = (query = '') => apiClient(`/admin/stores${query}`);

export const createStore = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/stores', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const updateStore = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/stores/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const deleteStore = (id: string, adminPassword: string) =>
  unwrapData(
    apiClient(`/admin/stores/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminPassword })
    })
  );
