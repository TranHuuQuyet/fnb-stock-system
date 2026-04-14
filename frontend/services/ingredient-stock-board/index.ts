import { apiClient, unwrapData } from '@/lib/api-client';

export const getIngredientStockBoard = (params: {
  year: number;
  month: number;
  operationType: 'STORE_USAGE' | 'TRANSFER';
  storeId?: string;
}) => {
  const query = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    operationType: params.operationType
  });

  if (params.storeId) {
    query.set('storeId', params.storeId);
  }

  return unwrapData(apiClient(`/ingredient-stock-board?${query.toString()}`));
};

export const saveIngredientStockLayout = (payload: unknown) =>
  unwrapData(
    apiClient('/ingredient-stock-board/layout', {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  );
