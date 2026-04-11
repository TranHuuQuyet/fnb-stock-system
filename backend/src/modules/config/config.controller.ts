import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { ConfigService } from './config.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';
import { QueryWhitelistsDto } from './dto/query-whitelists.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateNetworkBypassDto } from './dto/update-network-bypass.dto';
import { UpdateWhitelistDto } from './dto/update-whitelist.dto';

@ApiTags('Config')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.ADMIN)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('config')
  async getConfig() {
    return {
      data: await this.configService.getConfig()
    };
  }

  @Patch('config')
  async updateConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateConfigDto
  ) {
    return {
      data: await this.configService.updateConfig(user.userId, dto),
      message: 'Cập nhật cấu hình thành công'
    };
  }

  @Post('network-whitelists')
  async createWhitelist(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWhitelistDto
  ) {
    return {
      data: await this.configService.createWhitelist(user.userId, dto),
      message: 'Thêm mạng được phép thành công'
    };
  }

  @Get('network-whitelists')
  async listWhitelists(@Query() query: QueryWhitelistsDto) {
    return this.configService.listWhitelists(query);
  }

  @Patch('network-whitelists/:id')
  async updateWhitelist(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateWhitelistDto
  ) {
    return {
      data: await this.configService.updateWhitelist(user.userId, id, dto),
      message: 'Cập nhật mạng được phép thành công'
    };
  }

  @Delete('network-whitelists/:id')
  async deleteWhitelist(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.configService.deleteWhitelist(user.userId, id),
      message: 'Xóa mạng được phép thành công'
    };
  }
  @Get('network-bypasses')
  async listNetworkBypasses() {
    return this.configService.listNetworkBypasses();
  }

  @Patch('network-bypasses/:storeId')
  async updateNetworkBypass(
    @CurrentUser() user: JwtUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateNetworkBypassDto
  ) {
    return {
      data: await this.configService.updateNetworkBypass(user.userId, storeId, dto),
      message: 'Cập nhật emergency bypass thành công'
    };
  }
}
