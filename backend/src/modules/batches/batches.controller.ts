import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateBatchDto } from './dto/create-batch.dto';
import { QueryBatchesDto } from './dto/query-batches.dto';
import { SoftLockBatchDto } from './dto/soft-lock-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { BatchesService } from './batches.service';

@ApiTags('Batches')
@ApiBearerAuth()
@Controller()
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get('batches')
  async listAccessible(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryBatchesDto
  ) {
    return this.batchesService.listAccessible(user, query);
  }

  @Post('admin/batches')
  @Roles(UserRole.ADMIN)
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateBatchDto) {
    return {
      data: await this.batchesService.create(user.userId, dto),
      message: 'Batch created successfully'
    };
  }

  @Get('admin/batches')
  @Roles(UserRole.ADMIN)
  async listAdmin(@Query() query: QueryBatchesDto) {
    return this.batchesService.listAdmin(query);
  }

  @Get('admin/batches/:id')
  @Roles(UserRole.ADMIN)
  async getById(@Param('id') id: string) {
    return {
      data: await this.batchesService.getById(id)
    };
  }

  @Patch('admin/batches/:id')
  @Roles(UserRole.ADMIN)
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto
  ) {
    return {
      data: await this.batchesService.update(user.userId, id, dto),
      message: 'Batch updated successfully'
    };
  }

  @Post('admin/batches/:id/soft-lock')
  @Roles(UserRole.ADMIN)
  async softLock(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SoftLockBatchDto
  ) {
    return {
      data: await this.batchesService.softLock(user.userId, id, dto.reason),
      message: 'Batch soft locked successfully'
    };
  }

  @Post('admin/batches/:id/unlock')
  @Roles(UserRole.ADMIN)
  async unlock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.batchesService.unlock(user.userId, id),
      message: 'Batch unlocked successfully'
    };
  }
}
