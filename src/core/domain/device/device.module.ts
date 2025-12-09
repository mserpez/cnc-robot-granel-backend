import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggingModule } from '../../infrastructure/logging/logging.module';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

@Module({
  imports: [LoggingModule, PrismaModule],
  providers: [DeviceRepository, DeviceService],
  exports: [DeviceService],
  // DeviceRepository NO se exporta - solo se usa internamente
})
export class DeviceModule {}
