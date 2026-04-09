import { HttpException, HttpStatus } from '@nestjs/common';

export const appException = (
  status: HttpStatus,
  code: string,
  message: string,
  details?: unknown
) =>
  new HttpException(
    {
      code,
      message,
      ...(details ? { details } : {})
    },
    status
  );
