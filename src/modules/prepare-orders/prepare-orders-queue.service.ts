import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PREPARE_ORDERS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';

@Injectable()
export class PrepareOrdersQueueService {
  private readonly queue: Queue;

  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {
    this.queue = this.initializeQueue();
  }

  getQueue(): Queue {
    const context = 'PrepareOrdersQueueService.getQueue';
    this.loggingService.debug('Entering getQueue', context);

    try {
      this.loggingService.debug(
        `getQueue returning queue ${PREPARE_ORDERS_QUEUE}`,
        context,
      );
      return this.queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error accessing queue ${PREPARE_ORDERS_QUEUE}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private initializeQueue(): Queue {
    const context = 'PrepareOrdersQueueService.initializeQueue';
    this.loggingService.debug('Entering initializeQueue', context);

    try {
      const queue: Queue = this.queueService.getQueue(PREPARE_ORDERS_QUEUE);
      this.loggingService.debug(
        `initializeQueue returning queue ${PREPARE_ORDERS_QUEUE}`,
        context,
      );
      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error initializing queue ${PREPARE_ORDERS_QUEUE}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
