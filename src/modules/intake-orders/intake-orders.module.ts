import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { PrepareOrdersModule } from '../prepare-orders';
import { IntakeOrdersQueueService } from './intake-orders-queue.service';
import { IntakeOrdersWorker } from './intake-orders.worker';

@Module({
  imports: [LoggingModule, QueueModule, PrepareOrdersModule],
  providers: [IntakeOrdersQueueService, IntakeOrdersWorker],
  exports: [IntakeOrdersQueueService],
})
export class IntakeOrdersModule {}
