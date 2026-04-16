"use client";

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'MUST_CHANGE_PASSWORD';
export type Permission =
  | 'view_scan'
  | 'scan_transfer'
  | 'view_profile'
  | 'view_scan_logs'
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_stores'
  | 'manage_ingredients'
  | 'manage_batches'
  | 'manage_adjustments'
  | 'manage_recipes'
  | 'manage_config'
  | 'manage_whitelists'
  | 'view_audit_logs';

export type SessionUser = {
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
  mustChangePassword?: boolean;
};

export type SessionState = {
  user: SessionUser;
  mustChangePassword: boolean;
};

const SESSION_KEY = 'fnb-stock-session';
const DEVICE_KEY = 'fnb-stock-device-id';

export const getDeviceId = () => {
  if (typeof window === 'undefined') {
    return 'server-device';
  }

  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
};

export const getSession = (): SessionState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const setSession = (session: SessionState) => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  window.localStorage.removeItem(SESSION_KEY);
};

export const updateSessionUser = (user: SessionUser) => {
  const session = getSession();
  if (!session) {
    return;
  }

  setSession({
    ...session,
    user,
    mustChangePassword: user.mustChangePassword ?? session.mustChangePassword
  });
};

export const shouldForcePasswordChange = (session: SessionState | null) =>
  Boolean(session?.mustChangePassword || session?.user.status === 'MUST_CHANGE_PASSWORD');
