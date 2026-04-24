import { HttpStatus, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

import { ERROR_CODES } from '../constants/error-codes';
import type { RequestWithContext } from '../types/request-with-user';
import { readBooleanEnv } from '../utils/runtime-config';

type LoginAttemptState = {
  count: number;
  resetAt: number;
};

const readPositiveIntegerEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

@Injectable()
export class LoginRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoginRateLimitMiddleware.name);
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly enabled = readBooleanEnv(process.env.ENABLE_LOGIN_RATE_LIMIT, true);
  private readonly maxAttempts = readPositiveIntegerEnv(
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    5
  );
  private readonly windowMs = readPositiveIntegerEnv(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000
  );
  private readonly cleanupIntervalMs = readPositiveIntegerEnv(
    process.env.LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS,
    60 * 1000
  );
  private readonly maxTrackedKeys = readPositiveIntegerEnv(
    process.env.LOGIN_RATE_LIMIT_MAX_KEYS,
    10000
  );
  private lastCleanupAt = 0;

  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    if (!this.enabled) {
      next();
      return;
    }

    const now = Date.now();
    this.cleanupExpiredEntries(now);
    const username =
      typeof request.body?.username === 'string'
        ? request.body.username.trim().toLowerCase()
        : 'unknown-user';
    const ipAddress = request.ip ?? 'unknown-ip';
    const key = `${ipAddress}:${username}`;
    const current = this.attempts.get(key);

    if (!current || current.resetAt <= now) {
      this.attempts.set(key, {
        count: 1,
        resetAt: now + this.windowMs
      });
      this.attachSuccessfulLoginReset(key, response);
      next();
      return;
    }

    if (current.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      const requestId = request.requestId ?? 'unknown-request';
      const timestamp = new Date().toISOString();

      response.setHeader('Retry-After', retryAfterSeconds.toString());
      this.logger.warn({
        level: 'warn',
        message: 'Login rate limit exceeded',
        module: 'auth/login',
        requestId,
        ipAddress,
        username,
        retryAfterSeconds,
        timestamp
      });

      response.status(HttpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_RATE_LIMITED,
          message: 'Dang nhap qua nhanh. Vui long thu lai sau it phut.',
          details: {
            retryAfterSeconds
          }
        },
        meta: {
          requestId,
          timestamp
        }
      });
      return;
    }

    current.count += 1;
    this.attempts.set(key, current);
    this.attachSuccessfulLoginReset(key, response);
    next();
  }

  private attachSuccessfulLoginReset(key: string, response: Response) {
    response.on('finish', () => {
      if (response.statusCode < HttpStatus.BAD_REQUEST) {
        this.attempts.delete(key);
      }
    });
  }

  private cleanupExpiredEntries(now: number) {
    if (
      this.attempts.size < this.maxTrackedKeys &&
      now - this.lastCleanupAt < this.cleanupIntervalMs
    ) {
      return;
    }

    for (const [key, state] of this.attempts.entries()) {
      if (state.resetAt <= now) {
        this.attempts.delete(key);
      }
    }

    if (this.attempts.size > this.maxTrackedKeys) {
      const overflow = this.attempts.size - this.maxTrackedKeys;
      const oldestEntries = [...this.attempts.entries()]
        .sort((left, right) => left[1].resetAt - right[1].resetAt)
        .slice(0, overflow);

      for (const [key] of oldestEntries) {
        this.attempts.delete(key);
      }

      this.logger.warn({
        level: 'warn',
        message: 'Trimmed login rate limit state to stay within memory cap',
        trackedKeys: this.attempts.size,
        maxTrackedKeys: this.maxTrackedKeys,
        trimmedKeys: overflow,
        timestamp: new Date(now).toISOString()
      });
    }

    this.lastCleanupAt = now;
  }
}
