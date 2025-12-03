import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ORDER_INTAKE_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { PrepareOrderJobPayload } from '../prepare-orders';

@Injectable()
export class IntakeOrdersQueueService {
  private readonly queue: Queue<PrepareOrderJobPayload, void, string>;

  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {
    this.queue = this.initializeQueue();
  }

  getQueue(): Queue<PrepareOrderJobPayload, void, string> {
    const context = 'IntakeOrdersQueueService.getQueue';
    this.loggingService.debug('Entering getQueue', context);

    try {
      this.loggingService.debug(
        `getQueue returning queue ${ORDER_INTAKE_QUEUE.NAME}`,
        context,
      );
      return this.queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error accessing queue ${ORDER_INTAKE_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private initializeQueue(): Queue<PrepareOrderJobPayload, void, string> {
    const context = 'IntakeOrdersQueueService.initializeQueue';
    this.loggingService.debug('Entering initializeQueue', context);

    try {
      const queue = this.queueService.getQueue(
        ORDER_INTAKE_QUEUE.NAME,
      ) as Queue<PrepareOrderJobPayload, void, string>;
      this.loggingService.debug(
        `initializeQueue returning queue ${ORDER_INTAKE_QUEUE.NAME}`,
        context,
      );
      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error initializing queue ${ORDER_INTAKE_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
