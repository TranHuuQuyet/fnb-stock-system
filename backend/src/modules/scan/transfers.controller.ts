import { Controller, Get, Param, Patch, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireBusinessNetwork } from '../../common/decorators/require-business-network.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { ConfirmTransferDto } from './dto/confirm-transfer.dto';
import { QueryTransfersDto } from './dto/query-transfers.dto';
import { TransfersService } from './transfers.service';

@ApiTags('Transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get('stores')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async listTransferStores() {
    return this.transfersService.listTransferStores();
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @Permissions(PERMISSIONS.VIEW_SCAN_LOGS)
  async list(@CurrentUser() user: JwtUser, @Query() query: QueryTransfersDto) {
    return this.transfersService.list(user, query);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequireBusinessNetwork()
  async confirm(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConfirmTransferDto
  ) {
    return {
      data: await this.transfersService.confirm(user, id, dto),
      message: 'Xác nhận chuyển kho thành công'
    };
  }
}
