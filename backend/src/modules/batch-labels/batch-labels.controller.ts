import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { BatchLabelsService } from './batch-labels.service';

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
      message: 'QR generated successfully'
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
}
