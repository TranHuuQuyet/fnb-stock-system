import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Response } from 'express';

import { ERROR_CODES } from '../constants/error-codes';
import type { RequestWithContext } from '../types/request-with-user';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const requestId = request.requestId;
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as
        | string
        | {
            code?: string;
            message?: string;
            details?: unknown;
          };

      const message =
        typeof payload === 'string' ? payload : payload.message ?? exception.message;
      const code =
        typeof payload === 'string'
          ? ERROR_CODES.ERROR_INTERNAL_SERVER
          : payload.code ?? ERROR_CODES.ERROR_INTERNAL_SERVER;
      const details = typeof payload === 'string' ? undefined : payload.details;

      this.logger.error({
        level: 'error',
        message,
        module: request.path,
        requestId,
        timestamp,
        stack: exception.stack
      });

      response.status(status).json({
        success: false,
        error: {
          code,
          message,
          details
        },
        meta: {
          requestId,
          timestamp
        }
      });
      return;
    }

    const error = exception as Error;
    this.logger.error({
      level: 'error',
      message: error.message,
      module: request.path,
      requestId,
      timestamp,
      stack: error.stack
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.ERROR_INTERNAL_SERVER,
        message: 'Lỗi máy chủ nội bộ'
      },
      meta: {
        requestId,
        timestamp
      }
    });
  }
}
