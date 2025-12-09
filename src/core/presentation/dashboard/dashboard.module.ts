import { Module, forwardRef } from '@nestjs/common';
import { DeviceModule } from '../../domain/device/device.module';
import { ServerModule } from '../../domain/server/server.module';
import { LoggingModule } from '../../infrastructure/logging/logging.module';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    DeviceModule,
    ServerModule,
    LoggingModule,
    forwardRef(() => MqttModule), // forwardRef porque MqttModule puede depender de otros módulos
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
