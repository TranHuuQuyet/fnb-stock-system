"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { getDefaultRouteForRole, shouldForcePasswordChange } from '@/lib/auth';
import { useResolvedSession } from '@/hooks/use-resolved-session';

export default function HomePage() {
  const router = useRouter();
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;

  useEffect(() => {
    if (sessionQuery.isPending) {
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

    router.replace(getDefaultRouteForRole(session.user.role));
  }, [router, session, sessionQuery.isPending, sessionQuery.isUnauthorized]);

  if (sessionQuery.isPending || sessionQuery.isUnauthorized) {
    return null;
  }

  if (sessionQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <h1 className="text-lg font-semibold text-brand-900">Không tải được phiên đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-600">
            {(sessionQuery.error as Error).message}
          </p>
        </Card>
      </main>
    );
  }

  return null;
}
