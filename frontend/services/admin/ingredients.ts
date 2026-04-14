import { apiClient, unwrapData } from '@/lib/api-client';

export type IngredientUnitOption = {
  id: string;
  name: string;
  usageCount: number;
};

export type IngredientGroupOption = {
  id: string;
  name: string;
  usageCount: number;
};

export const listIngredients = (query = '') => apiClient(`/admin/ingredients${query}`);

export const listIngredientUnits = () =>
  unwrapData(
    apiClient<IngredientUnitOption[]>('/admin/ingredients/units')
  );

export const listIngredientGroups = () =>
  unwrapData(
    apiClient<IngredientGroupOption[]>('/admin/ingredients/groups')
  );

export const createIngredientUnit = (payload: { name: string }) =>
  unwrapData(
    apiClient<IngredientUnitOption>('/admin/ingredients/units', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const updateIngredientUnit = (id: string, payload: { name: string }) =>
  unwrapData(
    apiClient<IngredientUnitOption>(`/admin/ingredients/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );

export const deleteIngredientUnit = (id: string) =>
  unwrapData(
    apiClient<IngredientUnitOption>(`/admin/ingredients/units/${id}`, {
      method: 'DELETE'
    })
  );

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
