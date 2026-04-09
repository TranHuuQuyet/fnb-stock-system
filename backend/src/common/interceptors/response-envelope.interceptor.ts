import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import type { RequestWithContext } from '../types/request-with-user';

type ControllerPayload<T> = {
  data: T;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, unknown>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    return next.handle().pipe(
      map((value) => {
        const payload = value as ControllerPayload<unknown>;
        const data = payload?.data ?? value;
        const message = payload?.message;
        const pagination = payload?.pagination;

        return {
          success: true,
          data,
          ...(message ? { message } : {}),
          meta: {
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
            ...(pagination ? { pagination } : {})
          }
        };
      })
    );
  }
}
