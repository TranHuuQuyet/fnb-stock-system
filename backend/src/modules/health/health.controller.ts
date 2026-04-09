import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async health() {
    return {
      data: await this.healthService.health()
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    return {
      data: await this.healthService.readiness()
    };
  }
}
