import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { PREPARE_ORDER_JOB_NAME } from '../../constants';
import { LoggingService } from '../../core';
import { PrepareOrdersQueueService } from './prepare-orders-queue.service';
import type { PrepareOrderJobPayload } from './prepare-orders.types';

@Injectable()
export class PrepareOrdersService {
  constructor(
    private readonly queueService: PrepareOrdersQueueService,
    private readonly loggingService: LoggingService,
  ) {}

  async enqueuePrepareOrder(
    payload: PrepareOrderJobPayload,
    options?: JobsOptions,
  ): Promise<void> {
    const context = 'PrepareOrdersService.enqueuePrepareOrder';
    this.loggingService.debug(
      `Queueing prepare order job for order ${payload.orderId}`,
      context,
    );

    try {
      const queue: Queue = this.queueService.getQueue();
      await queue.add(PREPARE_ORDER_JOB_NAME, payload, options);
      this.loggingService.debug(
        `Prepare order job enqueued for order ${payload.orderId}`,
        context,
      );
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error enqueuing prepare order job for order ${payload.orderId}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
