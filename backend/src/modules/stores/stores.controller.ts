import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateStoreDto } from './dto/create-store.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoresService } from './stores.service';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('admin/stores')
@Roles(UserRole.ADMIN)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateStoreDto) {
    return {
      data: await this.storesService.create(user.userId, dto),
      message: 'Tạo cửa hàng thành công'
    };
  }

  @Get()
  async list(@Query() query: QueryStoresDto) {
    return this.storesService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return {
      data: await this.storesService.getById(id)
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto
  ) {
    return {
      data: await this.storesService.update(user.userId, id, dto),
      message: 'Cập nhật cửa hàng thành công'
    };
  }
}
