import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { AuthService } from './auth.service';
import { clearAuthCookie, setAuthCookie } from './auth-cookie';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(dto, request.ip ?? '0.0.0.0');
    setAuthCookie(response, result.accessToken);
    const { accessToken: _accessToken, ...session } = result;

    return {
      data: session,
      message: 'Dang nhap thanh cong'
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) response: Response
  ) {
    clearAuthCookie(response);

    return {
      data: await this.authService.logout(user),
      message: 'Logout successful'
    };
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return {
      data: await this.authService.me(user)
    };
  }

  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto
  ) {
    return {
      data: await this.authService.changePassword(user, dto),
      message: 'Doi mat khau thanh cong'
    };
  }
}
