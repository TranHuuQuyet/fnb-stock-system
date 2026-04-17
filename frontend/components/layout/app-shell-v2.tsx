"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';

import { AUTH_SESSION_QUERY_KEY } from '@/hooks/use-resolved-session';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { clearSession, getSession, Permission, Role } from '@/lib/auth';
import { localizeSyncState } from '@/lib/localization';
import { ApiError } from '@/lib/api-client';
import { logout } from '@/services/auth';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BusinessNetworkBanner } from './business-network-banner';

const links: Array<{ href: string; label: string; roles: Role[]; permission?: Permission }> = [
  {
    href: '/scan',
    label: 'Quét nguyên liệu',
    roles: ['STAFF', 'MANAGER', 'ADMIN'],
    permission: 'view_scan'
  },
  {
    href: '/scan-logs',
    label: 'Lịch sử quét',
    roles: ['STAFF', 'MANAGER', 'ADMIN'],
    permission: 'view_scan_logs'
  },
  {
    href: '/dashboard',
    label: 'Bảng điều khiển',
    roles: ['MANAGER', 'ADMIN'],
    permission: 'view_dashboard'
  },
  {
    href: '/ingredient-stock',
    label: 'Kho nguyên liệu',
    roles: ['STAFF', 'MANAGER', 'ADMIN']
  },
  {
    href: '/work-schedules',
    label: 'Ca làm việc',
    roles: ['STAFF', 'MANAGER', 'ADMIN']
  },
  {
    href: '/profile',
    label: 'Tài khoản',
    roles: ['STAFF', 'MANAGER', 'ADMIN'],
    permission: 'view_profile'
  },
  {
    href: '/admin/users',
    label: 'Người dùng',
    roles: ['ADMIN'],
    permission: 'manage_users'
  },
  {
    href: '/admin/stores',
    label: 'Cửa hàng',
    roles: ['ADMIN'],
    permission: 'manage_stores'
  },
  {
    href: '/admin/ingredients',
    label: 'Nguyên liệu',
    roles: ['ADMIN'],
    permission: 'manage_ingredients'
  },
  {
    href: '/admin/batches',
    label: 'Lô hàng',
    roles: ['ADMIN'],
    permission: 'manage_batches'
  },
  {
    href: '/admin/batch-adjustments',
    label: 'Điều chỉnh tồn',
    roles: ['ADMIN'],
    permission: 'manage_adjustments'
  },
  {
    href: '/admin/recipes',
    label: 'Công thức & POS',
    roles: ['ADMIN'],
    permission: 'manage_recipes'
  },
  {
    href: '/admin/config',
    label: 'Cấu hình',
    roles: ['ADMIN'],
    permission: 'manage_config'
  },
  {
    href: '/admin/whitelists',
    label: 'Mạng được phép',
    roles: ['ADMIN'],
    permission: 'manage_whitelists'
  },
  {
    href: '/admin/reports',
    label: 'Báo cáo admin',
    roles: ['ADMIN']
  },
  {
    href: '/admin/audit-logs',
    label: 'Nhật ký hệ thống',
    roles: ['ADMIN'],
    permission: 'view_audit_logs'
  }
] as const;

export const routePermissions: Record<string, Permission | undefined> = Object.fromEntries(
  links.map((item) => [item.href, item.permission])
) as Record<string, Permission | undefined>;

export function getRoutePermission(pathname: string) {
  return routePermissions[pathname];
}

export function AppShell({
  title,
  children,
  wide = true
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const session = getSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { syncState } = useOfflineSync();

  const role = session?.user.role;
  const permissions = session?.user.permissions ?? [];
  const routePermission = getRoutePermission(pathname ?? '');
  const shouldShowBusinessNetworkBanner =
    role !== 'ADMIN' &&
    pathname !== '/scan' &&
    (routePermission === 'view_scan_logs' || routePermission === 'view_dashboard');

  const sidebarClasses = clsx(
    'rounded-3xl bg-brand-900 p-4 text-white lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:min-h-0 lg:w-80 lg:self-start xl:w-[22rem]',
    sidebarOpen
      ? 'fixed inset-y-0 left-0 z-50 h-full w-72 translate-x-0 overflow-auto shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:h-[calc(100vh-2rem)] lg:translate-x-0 lg:overflow-auto lg:shadow-none'
      : 'fixed inset-y-0 left-0 z-50 h-full w-72 -translate-x-full overflow-auto shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:h-[calc(100vh-2rem)] lg:translate-x-0 lg:overflow-auto lg:shadow-none'
  );

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      clearSession();
      await queryClient.removeQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
      router.replace('/login');
    },
    onError: async (error: Error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        await queryClient.removeQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
        router.replace('/login');
      }
    }
  });

  return (
    <div className="min-h-screen bg-transparent">
      <div
        className={clsx(
          'mx-auto flex flex-col gap-4 px-4 py-4 lg:h-[calc(100vh-2rem)] lg:flex-row lg:items-start lg:overflow-hidden',
          wide ? 'max-w-[1800px]' : 'max-w-7xl'
        )}
      >
        <div className="sticky top-2 z-30 flex items-center justify-between rounded-3xl bg-brand-900 px-4 py-3 text-white shadow-sm lg:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-100">FNB CONTROL</p>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
          >
            <span className="flex h-5 w-5 flex-col justify-between">
              <span className="block h-[3px] w-full rounded-full bg-white" />
              <span className="block h-[3px] w-full rounded-full bg-white" />
              <span className="block h-[3px] w-full rounded-full bg-white" />
            </span>
          </button>
        </div>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside className={sidebarClasses}>
          <div className="mb-6 flex items-center justify-between lg:block">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-brand-100">FNB CONTROL</p>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-brand-100">{session?.user.fullName}</p>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 lg:hidden"
              aria-label="Đóng menu"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <Badge
              label={localizeSyncState(syncState)}
              tone={
                syncState === 'SYNCED'
                  ? 'success'
                  : syncState === 'SYNCING'
                    ? 'warning'
                    : syncState === 'SYNC_ERROR'
                      ? 'danger'
                      : 'neutral'
              }
            />
          </div>

          <nav className="grid gap-2 overflow-y-auto">
            {links
              .filter((item) => {
                if (!item.permission) {
                  return role ? item.roles.includes(role) : false;
                }

                return role === 'ADMIN' || permissions.includes(item.permission);
              })
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'rounded-2xl px-4 py-3 text-sm transition',
                    pathname === item.href
                      ? 'bg-white text-brand-900'
                      : 'text-brand-50 hover:bg-white/10'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          <Button
            className="mt-6"
            variant="secondary"
            fullWidth
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
          {logoutMutation.isError &&
          !(logoutMutation.error instanceof ApiError && logoutMutation.error.status === 401) ? (
            <p className="mt-2 text-sm text-brand-100">
              {(logoutMutation.error as Error).message}
            </p>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 space-y-4 overflow-y-auto lg:h-[calc(100vh-2rem)] lg:min-h-0">
          {shouldShowBusinessNetworkBanner ? <BusinessNetworkBanner /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
