"use client";

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api-client';
import {
  clearSession,
  getSession,
  setSession,
  toSessionState,
  type SessionState
} from '@/lib/auth';
import { fetchMe } from '@/services/auth';

export const AUTH_SESSION_QUERY_KEY = ['auth-session'] as const;

export function useResolvedSession(enabled = true) {
  const [resolvedSession, setResolvedSession] = useState<SessionState | null>(() => getSession());

  const query = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchMe,
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    const nextSession = toSessionState(query.data, query.data.mustChangePassword);
    setSession(nextSession);
    setResolvedSession(nextSession);
  }, [query.data]);

  const isUnauthorized = query.error instanceof ApiError && query.error.status === 401;

  useEffect(() => {
    if (!isUnauthorized) {
      return;
    }

    clearSession();
    setResolvedSession(null);
  }, [isUnauthorized]);

  return {
    ...query,
    session: query.data
      ? toSessionState(query.data, query.data.mustChangePassword)
      : resolvedSession,
    isUnauthorized
  };
}
