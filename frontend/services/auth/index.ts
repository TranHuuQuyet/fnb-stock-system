import { apiClient, unwrapData } from '@/lib/api-client';

export const login = (payload: { username: string; password: string }) =>
  unwrapData(
    apiClient<{
      user: {
        id: string;
        username: string;
        fullName: string;
        role: 'ADMIN' | 'MANAGER' | 'STAFF';
        status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'MUST_CHANGE_PASSWORD';
        store?: {
          id: string;
          code: string;
          name: string;
          timezone: string;
        } | null;
      };
      mustChangePassword: boolean;
    }>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload)
    })
  );

export const fetchMe = () => unwrapData(apiClient('/auth/me'));

export const changePassword = (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) =>
  unwrapData(
    apiClient('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

export const logout = () =>
  unwrapData(
    apiClient('/auth/logout', {
      method: 'POST'
    })
  );
