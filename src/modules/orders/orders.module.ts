import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { OrdersQueueService } from './orders-queue.service';

@Module({
  imports: [LoggingModule, QueueModule],
  providers: [OrdersQueueService],
  exports: [OrdersQueueService],
})
export class OrdersModule {}
