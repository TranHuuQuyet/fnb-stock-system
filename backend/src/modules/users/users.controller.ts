import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('admin/users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return {
      data: await this.usersService.create(user.userId, dto),
      message: 'Tạo người dùng thành công'
    };
  }

  @Get()
  async list(@Query() query: QueryUsersDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return {
      data: await this.usersService.getById(id)
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ) {
    return {
      data: await this.usersService.update(user.userId, id, dto),
      message: 'Cập nhật người dùng thành công'
    };
  }

  @Post(':id/lock')
  async lock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.usersService.lock(user.userId, id),
      message: 'Khóa người dùng thành công'
    };
  }

  @Post(':id/unlock')
  async unlock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.usersService.unlock(user.userId, id),
      message: 'Mở khóa người dùng thành công'
    };
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto
  ) {
    return {
      data: await this.usersService.resetPassword(user.userId, id, dto),
      message: 'Đặt lại mật khẩu thành công'
    };
  }

  @Delete(':id')
  async softDelete(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: DeleteUserDto
  ) {
    return {
      data: await this.usersService.softDelete(user.userId, id, dto),
      message: 'Xóa người dùng thành công'
    };
  }
}
