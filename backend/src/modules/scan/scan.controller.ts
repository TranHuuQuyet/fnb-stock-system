import { Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScanEntryMethod, UserRole } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireBusinessNetwork } from '../../common/decorators/require-business-network.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request-with-user';
import { ManualScanDto } from './dto/manual-scan.dto';
import { QueryScanLogsDto } from './dto/query-scan-logs.dto';
import { ScanDto } from './dto/scan.dto';
import { SyncScanDto } from './dto/sync-scan.dto';
import { ScanService } from './scan.service';

@ApiTags('Scan')
@ApiBearerAuth()
@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @RequireBusinessNetwork()
  async scan(
    @CurrentUser() user: JwtUser,
    @Body() dto: ScanDto,
    @Headers('x-device-id') headerDeviceId: string | undefined,
    @Req() request: Request
  ) {
    return {
      data: await this.scanService.scan(
        user,
        { ...dto, entryMethod: dto.entryMethod ?? ScanEntryMethod.CAMERA },
        headerDeviceId ?? dto.deviceId ?? 'unknown-device',
        request.ip ?? '0.0.0.0'
      )
    };
  }

  @Post('manual')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @RequireBusinessNetwork()
  async manual(
    @CurrentUser() user: JwtUser,
    @Body() dto: ManualScanDto,
    @Headers('x-device-id') headerDeviceId: string | undefined,
    @Req() request: Request
  ) {
    return {
      data: await this.scanService.manualScan(
        user,
        { ...dto, entryMethod: ScanEntryMethod.MANUAL },
        headerDeviceId ?? dto.deviceId ?? 'unknown-device',
        request.ip ?? '0.0.0.0'
      )
    };
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @RequireBusinessNetwork()
  async sync(
    @CurrentUser() user: JwtUser,
    @Body() dto: SyncScanDto,
    @Headers('x-device-id') headerDeviceId: string | undefined,
    @Req() request: Request
  ) {
    return this.scanService.sync(
      user,
      dto.events,
      headerDeviceId ?? 'unknown-device',
      request.ip ?? '0.0.0.0'
    );
  }

  @Get('network-status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async networkStatus(
    @CurrentUser() user: JwtUser,
    @Query('storeId') storeId: string | undefined,
    @Query('ssid') ssid: string | undefined,
    @Req() request: Request
  ) {
    return {
      data: await this.scanService.getNetworkStatus(
        user,
        storeId,
        request.ip ?? '0.0.0.0',
        ssid
      )
    };
  }

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @RequireBusinessNetwork()
  async listLogs(@CurrentUser() user: JwtUser, @Query() query: QueryScanLogsDto) {
    return this.scanService.listLogs(user, query);
  }
}
