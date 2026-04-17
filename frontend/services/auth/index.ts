import type { Permission, Role, UserStatus } from '@/lib/auth';
import { apiClient, unwrapData } from '@/lib/api-client';

export type AuthSessionPayload = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  permissions?: Permission[];
  store?: {
    id: string;
    code: string;
    name: string;
    timezone: string;
  } | null;
  mustChangePassword: boolean;
};

export const login = (payload: { username: string; password: string }) =>
  unwrapData(
    apiClient<{
      user: {
        id: string;
        username: string;
        fullName: string;
        role: Role;
        status: UserStatus;
        permissions?: Permission[];
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

export const fetchMe = () => unwrapData<AuthSessionPayload>(apiClient('/auth/me'));

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
