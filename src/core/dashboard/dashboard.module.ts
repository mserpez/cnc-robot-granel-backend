import { Module, forwardRef } from '@nestjs/common';
import { DeviceModule } from '../device/device.module';
import { LoggingModule } from '../logging/logging.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { ServerModule } from '../server/server.module';
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
