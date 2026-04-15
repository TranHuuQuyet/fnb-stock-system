import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BusinessNetworkGuard } from './common/guards/business-network.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { BatchesModule } from './modules/batches/batches.module';
import { BatchLabelsModule } from './modules/batch-labels/batch-labels.module';
import { StockAdjustmentsModule } from './modules/stock-adjustments/stock-adjustments.module';
import { ScanModule } from './modules/scan/scan.module';
import { DevicesModule } from './modules/devices/devices.module';
import { PosModule } from './modules/pos/pos.module';
import { AnomaliesModule } from './modules/anomalies/anomalies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { AppConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { WorkSchedulesModule } from './modules/work-schedules/work-schedules.module';
import { IngredientStockBoardModule } from './modules/ingredient-stock-board/ingredient-stock-board.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    StoresModule,
    IngredientsModule,
    BatchesModule,
    BatchLabelsModule,
    StockAdjustmentsModule,
    ScanModule,
    DevicesModule,
    PosModule,
    AnomaliesModule,
    DashboardModule,
    AuditModule,
    AppConfigModule,
    HealthModule,
    WorkSchedulesModule,
    IngredientStockBoardModule
  ],
  providers: [BusinessNetworkGuard, PermissionsGuard]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
