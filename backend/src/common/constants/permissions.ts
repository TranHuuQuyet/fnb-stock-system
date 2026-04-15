export const PERMISSIONS = {
  VIEW_SCAN: 'view_scan',
  SCAN_TRANSFER: 'scan_transfer',
  VIEW_PROFILE: 'view_profile',
  VIEW_SCAN_LOGS: 'view_scan_logs',
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  MANAGE_STORES: 'manage_stores',
  MANAGE_INGREDIENTS: 'manage_ingredients',
  MANAGE_BATCHES: 'manage_batches',
  MANAGE_ADJUSTMENTS: 'manage_adjustments',
  MANAGE_RECIPES: 'manage_recipes',
  MANAGE_CONFIG: 'manage_config',
  MANAGE_WHITELISTS: 'manage_whitelists',
  VIEW_AUDIT_LOGS: 'view_audit_logs'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const PERMISSION_VALUES = Object.values(PERMISSIONS);
