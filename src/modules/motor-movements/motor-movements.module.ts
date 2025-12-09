import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { MotorMovementsQueueService } from './motor-movements-queue.service';
import { MotorMovementsService } from './motor-movements.service';
import { MotorMovementsWorker } from './motor-movements.worker';

@Module({
  imports: [LoggingModule, QueueModule],
  providers: [
    MotorMovementsQueueService,
    MotorMovementsService,
    MotorMovementsWorker,
  ],
  exports: [MotorMovementsQueueService, MotorMovementsService],
})
export class MotorMovementsModule {}
