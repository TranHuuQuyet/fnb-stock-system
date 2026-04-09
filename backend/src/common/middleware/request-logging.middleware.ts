import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

import type { RequestWithContext } from '../types/request-with-user';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const startedAt = Date.now();

    response.on('finish', () => {
      this.logger.log({
        level: 'info',
        message: `${request.method} ${request.originalUrl}`,
        module: 'http',
        requestId: request.requestId,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString()
      });
    });

    next();
  }
}
