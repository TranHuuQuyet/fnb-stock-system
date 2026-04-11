import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { ERROR_CODES } from '../constants/error-codes';
import { REQUIRE_BUSINESS_NETWORK_KEY } from '../decorators/require-business-network.decorator';
import type { AuthenticatedRequest } from '../types/request-with-user';
import { appException } from '../utils/app-exception';
import { ConfigService } from '../../modules/config/config.service';

@Injectable()
export class BusinessNetworkGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresBusinessNetwork = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_BUSINESS_NETWORK_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiresBusinessNetwork) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const currentUser = request.user;

    if (!currentUser || currentUser.role === UserRole.ADMIN) {
      return true;
    }

    if (!currentUser.storeId) {
      throw appException(
        HttpStatus.FORBIDDEN,
        ERROR_CODES.AUTH_FORBIDDEN,
        'Thiáº¿u pháº¡m vi cá»­a hÃ ng Ä‘á»ƒ kiá»ƒm tra quyá»n truy cáº­p nghiá»‡p vá»¥'
      );
    }

    const networkStatus = await this.configService.getBusinessNetworkStatus(
      currentUser.storeId,
      request.ip ?? '0.0.0.0'
    );

    if (networkStatus.canAccessBusinessOperations) {
      return true;
    }

    const message = networkStatus.hasActiveWhitelist
      ? 'Báº¡n pháº£i káº¿t ná»‘i Ä‘Ãºng máº¡ng Ä‘Æ°á»£c phÃ©p cá»§a chi nhÃ¡nh Ä‘á»ƒ sá»­ dá»¥ng nghiá»‡p vá»¥ nÃ y'
      : 'Chi nhÃ¡nh hiá»‡n chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh máº¡ng Ä‘Æ°á»£c phÃ©p hoáº·c emergency bypass há»£p lá»‡';

    throw appException(
      HttpStatus.FORBIDDEN,
      ERROR_CODES.ERROR_NETWORK_RESTRICTED,
      message,
      networkStatus
    );
  }
}
