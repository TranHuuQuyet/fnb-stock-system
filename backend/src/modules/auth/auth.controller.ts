import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return {
      data: await this.authService.login(dto),
      message: 'Đăng nhập thành công'
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  async logout() {
    return {
      data: await this.authService.logout(),
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
      message: 'Đổi mật khẩu thành công'
    };
  }
}
