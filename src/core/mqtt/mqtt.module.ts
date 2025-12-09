import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module';
import { MqttService } from './mqtt.service';

@Module({
  imports: [DeviceModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
