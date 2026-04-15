import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ERROR_CODES } from '../constants/error-codes';
import type { Permission } from '../constants/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../types/request-with-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_FORBIDDEN,
        message: 'You do not have permission to access this resource'
      });
    }

    if (request.user.role === UserRole.ADMIN) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: {
        permissions: true
      }
    });

    const grantedPermissions = new Set(user?.permissions ?? []);
    const hasAllPermissions = requiredPermissions.every((permission) =>
      grantedPermissions.has(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_FORBIDDEN,
        message: 'You do not have permission to access this resource'
      });
    }

    return true;
  }
}
