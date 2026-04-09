import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { RequestWithContext } from '../types/request-with-user';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id') ?? uuidv4();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
