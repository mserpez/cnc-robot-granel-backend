import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DeviceModule } from '../domain/device/device.module';
import { LoggingModule } from '../infrastructure/logging/logging.module';
import { MqttModule } from '../infrastructure/mqtt/mqtt.module';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { LEDService } from './leds/leds.service';
import { PeripheralCommandWorker } from './peripheral-command.worker';
import { PeripheralCoordinatorController } from './peripheral-coordinator.controller';
import { PeripheralCoordinatorRepository } from './peripheral-coordinator.repository';
import { PeripheralCoordinatorService } from './peripheral-coordinator.service';
import { PeripheralQueueService } from './peripheral-queue.service';

@Module({
  imports: [PrismaModule, LoggingModule, QueueModule, MqttModule, DeviceModule],
  controllers: [PeripheralCoordinatorController],
  providers: [
    PeripheralCoordinatorRepository,
    PeripheralCoordinatorService,
    PeripheralQueueService,
    PeripheralCommandWorker,
    LEDService,
  ],
  exports: [PeripheralCoordinatorService, LEDService, PeripheralQueueService],
})
export class PeripheralCoordinatorModule {}
