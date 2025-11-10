import { Module } from '@nestjs/common';
import { LoggingModule, QueueModule } from '../../core';
import { IntakeOrdersQueueService } from './intake-orders-queue.service';

@Module({
  imports: [LoggingModule, QueueModule],
  providers: [IntakeOrdersQueueService],
  exports: [IntakeOrdersQueueService],
})
export class IntakeOrdersModule {}
