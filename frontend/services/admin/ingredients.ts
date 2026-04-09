import { apiClient, unwrapData } from '@/lib/api-client';

export const listIngredients = (query = '') => apiClient(`/admin/ingredients${query}`);

export const createIngredient = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/ingredients', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const updateIngredient = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/ingredients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const disableIngredient = (id: string) =>
  unwrapData(
    apiClient(`/admin/ingredients/${id}`, {
      method: 'DELETE'
    })
  );
