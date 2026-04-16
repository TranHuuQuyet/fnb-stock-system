import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { BatchLabelsService } from './batch-labels.service';
import { IssueBatchLabelsDto } from './dto/issue-batch-labels.dto';

@ApiTags('Batch Labels')
@ApiBearerAuth()
@Controller('admin/batches')
@Roles(UserRole.ADMIN)
export class BatchLabelsController {
  constructor(private readonly batchLabelsService: BatchLabelsService) {}

  @Post(':id/generate-qr')
  async generateQr(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.batchLabelsService.generateQr(user.userId, id),
      message: 'Tao ma QR thanh cong'
    };
  }

  @Get(':id/qr')
  async getQr(@Param('id') id: string) {
    return {
      data: await this.batchLabelsService.getQr(id)
    };
  }

  @Get(':id/label')
  async getLabel(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return {
      data: await this.batchLabelsService.getLabel(user.userId, id)
    };
  }

  @Post(':id/labels/issue')
  async issueLabels(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: IssueBatchLabelsDto
  ) {
    return {
      data: await this.batchLabelsService.issueLabels(user.userId, id, dto.quantity, dto.reason),
      message: 'Phat hanh tem in thanh cong'
    };
  }
}
