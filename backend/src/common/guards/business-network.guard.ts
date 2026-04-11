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
        'Thiếu phạm vi cửa hàng để kiểm tra quyền truy cập nghiệp vụ'
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
      ? 'Bạn phải kết nối đúng mạng được phép của chi nhánh để sử dụng nghiệp vụ này'
      : 'Chi nhánh hiện chưa được cấu hình mạng được phép hoặc emergency bypass hợp lệ';

    throw appException(
      HttpStatus.FORBIDDEN,
      ERROR_CODES.ERROR_NETWORK_RESTRICTED,
      message,
      networkStatus
    );
  }
}
