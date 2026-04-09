"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import clsx from 'clsx';

import { clearSession, getSession, Role } from '@/lib/auth';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const links: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: '/scan', label: 'Scan', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/scan-logs', label: 'Scan Logs', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/dashboard', label: 'Dashboard', roles: ['MANAGER', 'ADMIN'] },
  { href: '/profile', label: 'Profile', roles: ['STAFF', 'MANAGER', 'ADMIN'] },
  { href: '/admin/users', label: 'Users', roles: ['ADMIN'] },
  { href: '/admin/stores', label: 'Stores', roles: ['ADMIN'] },
  { href: '/admin/ingredients', label: 'Ingredients', roles: ['ADMIN'] },
  { href: '/admin/batches', label: 'Batches', roles: ['ADMIN'] },
  { href: '/admin/batch-adjustments', label: 'Adjustments', roles: ['ADMIN'] },
  { href: '/admin/recipes', label: 'Recipes', roles: ['ADMIN'] },
  { href: '/admin/config', label: 'Config', roles: ['ADMIN'] },
  { href: '/admin/whitelists', label: 'Whitelists', roles: ['ADMIN'] },
  { href: '/admin/audit-logs', label: 'Audit', roles: ['ADMIN'] }
] as const;

export function AppShell({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  const session = getSession();
  const pathname = usePathname();
  const router = useRouter();
  const { syncState } = useOfflineSync();

  const role = session?.user.role;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row">
        <aside className="w-full rounded-3xl bg-brand-900 p-4 text-white md:sticky md:top-4 md:w-72 md:self-start">
          <div className="mb-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-brand-100">FNB Control</p>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-brand-100">{session?.user.fullName}</p>
          </div>

          <div className="mb-4">
            <Badge
              label={syncState}
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

          <nav className="grid gap-2">
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
            Logout
          </Button>
        </aside>

        <main className="flex-1 space-y-4">{children}</main>
      </div>
    </div>
  );
}
