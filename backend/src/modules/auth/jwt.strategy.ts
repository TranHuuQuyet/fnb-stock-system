import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtUser } from '../../common/types/request-with-user';
import { PrismaService } from '../../prisma/prisma.service';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { extractJwtFromCookie } from './auth-cookie';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => (request ? extractJwtFromCookie(request) : null),
        ExtractJwt.fromAuthHeaderAsBearerToken()
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'super-secret-change-me'
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user || user.status === UserStatus.LOCKED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'User session is no longer valid'
      });
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      status: user.status
    };
  }
}
