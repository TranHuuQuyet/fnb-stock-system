import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { StoresService } from './stores.service';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class StoresAccessController {
  constructor(private readonly storesService: StoresService) {}

  @Get('accessible')
  async listAccessible() {
    return this.storesService.listAccessible();
  }
}
