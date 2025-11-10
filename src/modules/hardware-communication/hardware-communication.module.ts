import { Module } from '@nestjs/common';
import { LoggingModule } from '../../core';
import { HardwareCommunicationService } from './hardware-communication.service';

@Module({
  imports: [LoggingModule],
  providers: [HardwareCommunicationService],
  exports: [HardwareCommunicationService],
})
export class HardwareCommunicationModule {}
