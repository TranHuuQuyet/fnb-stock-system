import { unwrapData, apiClient } from '@/lib/api-client';

export const getDashboardSummary = (storeId: string | undefined, businessDate: string) =>
  unwrapData(
    apiClient(
      `/dashboard/summary?businessDate=${businessDate}${storeId ? `&storeId=${storeId}` : ''}`
    )
  );

export const getReconciliation = (storeId: string | undefined, businessDate: string) =>
  unwrapData(
    apiClient(
      `/pos/reconciliation?businessDate=${businessDate}${storeId ? `&storeId=${storeId}` : ''}`
    )
  );

export const runAnomalies = (storeId: string | undefined, businessDate: string) =>
  unwrapData(
    apiClient(
      `/anomalies/run?businessDate=${businessDate}${storeId ? `&storeId=${storeId}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    )
  );
