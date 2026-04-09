import { apiClient, unwrapData } from '@/lib/api-client';

export const listPosProducts = (query = '') => apiClient(`/admin/pos-products${query}`);
export const createPosProduct = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/pos-products', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );
export const updatePosProduct = (id: string, payload: unknown) =>
  unwrapData(
    apiClient(`/admin/pos-products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );
export const listRecipes = () => unwrapData(apiClient('/admin/recipes'));
export const getRecipeByProduct = (productId: string) =>
  unwrapData(apiClient(`/admin/recipes/${productId}`));
export const createRecipe = (payload: unknown) =>
  unwrapData(
    apiClient('/admin/recipes', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );
export const replaceRecipe = (productId: string, items: unknown[]) =>
  unwrapData(
    apiClient(`/admin/recipes/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ items })
    })
  );
export const importPosSales = (records: unknown[]) =>
  unwrapData(
    apiClient('/pos/sales/import', {
      method: 'POST',
      body: JSON.stringify({ records })
    })
  );
