"use client";

import { clearSession } from './auth';
import { localizeApiError } from './localization';

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  message?: string;
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
};

export class ApiError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function apiClient<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<SuccessEnvelope<T>> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-device-id', typeof window !== 'undefined' ? localStorage.getItem('fnb-stock-device-id') ?? 'browser-device' : 'server-device');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers
  });

  const payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  if (!response.ok || !payload.success) {
    if (response.status === 401) {
      clearSession();
    }
    const errorPayload = payload as ErrorEnvelope;
    const code = errorPayload.error?.code ?? 'ERROR_INTERNAL_SERVER';
    const fallbackMessage = errorPayload.error?.message ?? 'Có lỗi không mong muốn xảy ra';
    throw new ApiError(
      response.status,
      code,
      localizeApiError(code, fallbackMessage),
      errorPayload.error?.details
    );
  }

  return payload;
}

export const unwrapData = async <T>(
  promise: Promise<SuccessEnvelope<T>>
): Promise<T> => (await promise).data;
