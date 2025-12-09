import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { MotorMovementsModule } from '../motor-movements';
import { PrepareOrdersQueueService } from './prepare-orders-queue.service';
import { PrepareOrdersService } from './prepare-orders.service';
import { PrepareOrdersWorker } from './prepare-orders.worker';

@Module({
  imports: [LoggingModule, QueueModule, MotorMovementsModule],
  providers: [
    PrepareOrdersQueueService,
    PrepareOrdersService,
    PrepareOrdersWorker,
  ],
  exports: [PrepareOrdersQueueService, PrepareOrdersService],
})
export class PrepareOrdersModule {}
