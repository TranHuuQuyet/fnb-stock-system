"use client";

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo } from 'react';

import { AppShell } from './app-shell';
import { getSession, shouldForcePasswordChange } from '@/lib/auth';

export function ProtectedPage({
  title,
  children,
  allowedRoles
}: {
  title: string;
  children: ReactNode;
  allowedRoles?: Array<'ADMIN' | 'MANAGER' | 'STAFF'>;
}) {
  const router = useRouter();
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

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      router.replace(session.user.role === 'STAFF' ? '/scan' : '/dashboard');
    }
  }, [allowedRoles, router, session]);

  if (!session) {
    return null;
  }

  return <AppShell title={title}>{children}</AppShell>;
}
