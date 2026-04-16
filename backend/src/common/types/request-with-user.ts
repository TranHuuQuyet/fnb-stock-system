import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';

export type JwtUser = {
  userId: string;
  username: string;
  role: UserRole;
  storeId: string | null;
  status: UserStatus;
  sessionVersion: number;
};

export type RequestWithContext = Request & {
  requestId: string;
};

export type AuthenticatedRequest = RequestWithContext & {
  user: JwtUser;
};
