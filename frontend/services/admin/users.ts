import { apiClient, unwrapData } from '@/lib/api-client';

export const listUsers = (query = '') => apiClient(`/admin/users${query}`);

export const createUser = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const updateUser = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const lockUser = (id: string) =>
  unwrapData(
    apiClient(`/admin/users/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  );

export const unlockUser = (id: string) =>
  unwrapData(
    apiClient(`/admin/users/${id}/unlock`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  );

export const resetPassword = (id: string, temporaryPassword?: string) =>
  unwrapData(
    apiClient(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword })
    })
  );
