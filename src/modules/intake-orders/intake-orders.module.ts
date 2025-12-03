import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { PrepareOrdersModule } from '../prepare-orders';
import { IntakeOrdersQueueService } from './intake-orders-queue.service';
import { IntakeOrdersController } from './intake-orders.controller';
import { IntakeOrdersService } from './intake-orders.service';
import { IntakeOrdersWorker } from './intake-orders.worker';

@Module({
  imports: [LoggingModule, QueueModule, PrepareOrdersModule],
  controllers: [IntakeOrdersController],
  providers: [
    IntakeOrdersQueueService,
    IntakeOrdersService,
    IntakeOrdersWorker,
  ],
  exports: [IntakeOrdersQueueService, IntakeOrdersService],
})
export class IntakeOrdersModule {}
