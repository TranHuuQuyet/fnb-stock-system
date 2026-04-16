import { Request, Response } from 'express';

import { readBooleanEnv } from '../../common/utils/runtime-config';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME?.trim() || 'fnb_stock_session';

const parseDurationMs = (value: string | undefined, fallback: number) => {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1] ?? 0);
  const unit = (match[2] ?? 'ms').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    return fallback;
  }

  return amount * multiplier;
};

const isSecureCookie = () =>
  readBooleanEnv(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');

const getSameSite = (): 'lax' | 'strict' | 'none' => {
  const raw = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === 'strict' || raw === 'none') {
    return raw;
  }

  return 'lax';
};

const getCookieMaxAgeMs = () =>
  parseDurationMs(
    process.env.AUTH_COOKIE_MAX_AGE_MS ?? process.env.JWT_EXPIRES_IN,
    24 * 60 * 60 * 1000
  );

const parseCookieHeader = (cookieHeader: string | undefined) => {
  const cookieMap = new Map<string, string>();
  if (!cookieHeader) {
    return cookieMap;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) {
      continue;
    }

    cookieMap.set(rawName, decodeURIComponent(rawValueParts.join('=')));
  }

  return cookieMap;
};

export const AUTH_COOKIE_NAME = COOKIE_NAME;

export const extractJwtFromCookie = (request: Request) => {
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies.get(COOKIE_NAME) ?? null;
};

export const setAuthCookie = (response: Response, token: string) => {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: getSameSite(),
    path: '/',
    maxAge: getCookieMaxAgeMs()
  });
};

export const clearAuthCookie = (response: Response) => {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: getSameSite(),
    path: '/'
  });
};
