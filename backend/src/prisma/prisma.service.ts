import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type TransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxRetries?: number;
  shouldRetry?: (error: unknown) => boolean;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly DEFAULT_TRANSACTION_RETRIES = 3;

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runInTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const {
      isolationLevel = Prisma.TransactionIsolationLevel.Serializable,
      maxRetries = PrismaService.DEFAULT_TRANSACTION_RETRIES,
      shouldRetry = (error: unknown) => this.isRetryableTransactionError(error)
    } = options;

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.$transaction(operation, { isolationLevel });
      } catch (error) {
        if (attempt >= maxRetries || !shouldRetry(error)) {
          throw error;
        }

        await this.delay((attempt + 1) * 25);
      }
    }
  }

  isRetryableTransactionError(error: unknown) {
    return this.getErrorCode(error) === 'P2034';
  }

  isUniqueConstraintError(error: unknown, expectedTargets?: string[]) {
    if (this.getErrorCode(error) !== 'P2002') {
      return false;
    }

    if (!expectedTargets || expectedTargets.length === 0) {
      return true;
    }

    const actualTargets = this.getErrorTargets(error);
    return expectedTargets.every((target) => actualTargets.includes(target));
  }

  private getErrorCode(error: unknown) {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return null;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }

  private getErrorTargets(error: unknown) {
    if (!error || typeof error !== 'object' || !('meta' in error)) {
      return [] as string[];
    }

    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (Array.isArray(target)) {
      return target.filter((item): item is string => typeof item === 'string');
    }

    return typeof target === 'string' ? [target] : [];
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
