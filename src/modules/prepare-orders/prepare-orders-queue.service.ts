import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ORDER_PREPARE_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { PrepareOrderJobPayload } from './prepare-orders.types';

@Injectable()
export class PrepareOrdersQueueService {
  private readonly queue: Queue<PrepareOrderJobPayload, void, string>;

  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {
    this.queue = this.initializeQueue();
  }

  getQueue(): Queue<PrepareOrderJobPayload, void, string> {
    const context = 'PrepareOrdersQueueService.getQueue';
    this.loggingService.debug('Entering getQueue', context);

    try {
      this.loggingService.debug(
        `getQueue returning queue ${ORDER_PREPARE_QUEUE.NAME}`,
        context,
      );
      return this.queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error accessing queue ${ORDER_PREPARE_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private initializeQueue(): Queue<PrepareOrderJobPayload, void, string> {
    const context = 'PrepareOrdersQueueService.initializeQueue';
    this.loggingService.debug('Entering initializeQueue', context);

    try {
      const queue: Queue<PrepareOrderJobPayload, void, string> =
        this.queueService.getQueue(ORDER_PREPARE_QUEUE.NAME);
      this.loggingService.debug(
        `initializeQueue returning queue ${ORDER_PREPARE_QUEUE.NAME}`,
        context,
      );
      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error initializing queue ${ORDER_PREPARE_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
