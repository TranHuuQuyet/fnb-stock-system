import { apiClient, unwrapData } from '@/lib/api-client';

export const getWorkSchedule = (params: { year: number; month: number; storeId?: string }) => {
  const query = new URLSearchParams({
    year: String(params.year),
    month: String(params.month)
  });

  if (params.storeId) {
    query.set('storeId', params.storeId);
  }

  return unwrapData(apiClient(`/work-schedules?${query.toString()}`));
};

export const saveWorkSchedule = (payload: unknown) =>
  unwrapData(
    apiClient('/work-schedules', {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  );
