"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getSession, shouldForcePasswordChange } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    if (shouldForcePasswordChange(session)) {
      router.replace('/change-password');
      return;
    }

    router.replace(session.user.role === 'STAFF' ? '/scan' : '/dashboard');
  }, [router]);

  return null;
}
