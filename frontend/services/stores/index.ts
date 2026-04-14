import { apiClient } from '@/lib/api-client';

export const listAccessibleStores = () =>
  apiClient<Array<{ id: string; code: string; name: string; timezone: string }>>(
    '/stores/accessible'
  );
