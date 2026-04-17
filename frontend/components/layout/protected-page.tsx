"use client";

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

import { AppShell, getRoutePermission } from './app-shell-v2';
import { Card } from '@/components/ui/card';
import { getDefaultRouteForRole, shouldForcePasswordChange } from '@/lib/auth';
import { useResolvedSession } from '@/hooks/use-resolved-session';

export function ProtectedPage({
  title,
  children,
  allowedRoles,
  wide = true
}: {
  title: string;
  children: ReactNode;
  allowedRoles?: Array<'ADMIN' | 'MANAGER' | 'STAFF'>;
  wide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;

  useEffect(() => {
    if (sessionQuery.isPending) {
      return;
    }

    if (sessionQuery.isError && !sessionQuery.isUnauthorized) {
      return;
    }

    if (sessionQuery.isUnauthorized || !session) {
      router.replace('/login');
      return;
    }

    if (shouldForcePasswordChange(session)) {
      router.replace('/change-password');
      return;
    }

    const routePermission = getRoutePermission(pathname ?? '');
    if (routePermission) {
      if (session.user.role !== 'ADMIN' && !(session.user.permissions ?? []).includes(routePermission)) {
        router.replace(getDefaultRouteForRole(session.user.role));
      }
      return;
    }

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      router.replace(getDefaultRouteForRole(session.user.role));
    }
  }, [allowedRoles, pathname, router, session, sessionQuery.isPending, sessionQuery.isUnauthorized]);

  if (sessionQuery.isError && !sessionQuery.isUnauthorized) {
    return (
      <div className="min-h-screen px-4 py-10">
        <Card className="mx-auto max-w-xl">
          <h1 className="text-lg font-semibold text-brand-900">Không xác minh được phiên đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-600">
            {(sessionQuery.error as Error).message}
          </p>
        </Card>
      </div>
    );
  }

  if (sessionQuery.isPending || !session) {
    return null;
  }

  return <AppShell title={title} wide={wide}>{children}</AppShell>;
}
