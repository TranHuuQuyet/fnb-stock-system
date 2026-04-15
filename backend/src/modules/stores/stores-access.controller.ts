import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { StoresService } from './stores.service';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class StoresAccessController {
  constructor(private readonly storesService: StoresService) {}

  @Get('accessible')
  async listAccessible(@CurrentUser() user: JwtUser) {
    return this.storesService.listAccessible(user);
  }
}
