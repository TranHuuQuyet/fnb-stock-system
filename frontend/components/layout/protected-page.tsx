"use client";

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo } from 'react';

import { AppShell, getRoutePermission } from './app-shell-v2';
import { getSession, shouldForcePasswordChange } from '@/lib/auth';

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
  const session = useMemo(() => getSession(), []);

  useEffect(() => {
    if (!session) {
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
        router.replace(session.user.role === 'STAFF' ? '/scan' : '/dashboard');
      }
      return;
    }

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      router.replace(session.user.role === 'STAFF' ? '/scan' : '/dashboard');
    }
  }, [allowedRoles, pathname, router, session]);

  if (!session) {
    return null;
  }

  return <AppShell title={title} wide={wide}>{children}</AppShell>;
}
