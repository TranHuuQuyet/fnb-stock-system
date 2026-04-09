"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import clsx from 'clsx';

import { clearSession, getSession, Role } from '@/lib/auth';
import { localizeSyncState } from '@/lib/localization';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const links: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: '/scan', label: 'Quét nguyên liệu', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/scan-logs', label: 'Lịch sử quét', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/dashboard', label: 'Bảng điều khiển', roles: ['MANAGER', 'ADMIN'] },
  { href: '/profile', label: 'Tài khoản', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/admin/users', label: 'Người dùng', roles: ['ADMIN'] },
  { href: '/admin/stores', label: 'Cửa hàng', roles: ['ADMIN'] },
  { href: '/admin/ingredients', label: 'Nguyên liệu', roles: ['ADMIN'] },
  { href: '/admin/batches', label: 'Lô hàng', roles: ['ADMIN'] },
  { href: '/admin/batch-adjustments', label: 'Điều chỉnh tồn', roles: ['ADMIN'] },
  { href: '/admin/recipes', label: 'Công thức & POS', roles: ['ADMIN'] },
  { href: '/admin/config', label: 'Cấu hình', roles: ['ADMIN'] },
  { href: '/admin/whitelists', label: 'Mạng được phép', roles: ['ADMIN'] },
  { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', roles: ['ADMIN'] }
] as const;

export function AppShell({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const session = getSession();
  const pathname = usePathname();
  const router = useRouter();
  const { syncState } = useOfflineSync();

  const role = session?.user.role;

  const sidebarClasses = clsx(
    'rounded-3xl bg-brand-900 p-4 text-white lg:sticky lg:top-4 lg:w-72 lg:self-start lg:h-[calc(100vh-2rem)] lg:min-h-0',
    sidebarOpen
      ? 'fixed inset-y-0 left-0 z-50 w-72 h-full overflow-auto shadow-2xl transform translate-x-0 transition-transform duration-300 ease-in-out lg:static lg:top-auto lg:h-[calc(100vh-2rem)] lg:overflow-auto lg:shadow-none lg:translate-x-0'
      : 'fixed inset-y-0 left-0 z-50 w-72 h-full overflow-auto shadow-2xl transform -translate-x-full transition-transform duration-300 ease-in-out lg:static lg:top-auto lg:h-[calc(100vh-2rem)] lg:overflow-auto lg:shadow-none lg:translate-x-0'
  );

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
        <div className="flex items-center justify-between lg:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-100">FNB CONTROL</p>
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
          >
            <span className="flex h-5 w-5 flex-col justify-between">
              <span className="block h-[3px] w-full rounded-full bg-black" />
              <span className="block h-[3px] w-full rounded-full bg-black" />
              <span className="block h-[3px] w-full rounded-full bg-black" />
            </span>
          </button>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

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
              ✕
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
              .filter((item) => role && item.roles.includes(role))
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
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            Đăng xuất
          </Button>
        </aside>

        <main className="flex-1 space-y-4 overflow-y-auto lg:h-[calc(100vh-2rem)] lg:min-h-0">{children}</main>
      </div>
    </div>
  );
}
