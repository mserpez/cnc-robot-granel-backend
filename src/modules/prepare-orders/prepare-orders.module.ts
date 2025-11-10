import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { PrepareOrdersQueueService } from './prepare-orders-queue.service';
import { PrepareOrdersService } from './prepare-orders.service';

@Module({
  imports: [LoggingModule, QueueModule],
  providers: [PrepareOrdersQueueService, PrepareOrdersService],
  exports: [PrepareOrdersQueueService, PrepareOrdersService],
})
export class PrepareOrdersModule {}
