import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@ApiTags('Stock Adjustments')
@ApiBearerAuth()
@Controller('admin/batches/:id/adjustments')
@Roles(UserRole.ADMIN)
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStockAdjustmentDto
  ) {
    return {
      data: await this.stockAdjustmentsService.create(user.userId, id, dto),
      message: 'Tạo phiếu điều chỉnh tồn thành công'
    };
  }

  @Get()
  async list(@Param('id') id: string) {
    return {
      data: await this.stockAdjustmentsService.list(id)
    };
  }
}
