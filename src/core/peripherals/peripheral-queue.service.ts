import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PERIPHERAL_COMMANDS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { PeripheralCommandJobPayload } from './peripheral-coordinator.types';

@Injectable()
export class PeripheralQueueService {
  private readonly queue: Queue<PeripheralCommandJobPayload, void, string>;

  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {
    this.queue = this.initializeQueue();
  }

  getQueue(): Queue<PeripheralCommandJobPayload, void, string> {
    const context = 'PeripheralQueueService.getQueue';
    this.loggingService.debug('Entering getQueue', context);

    try {
      this.loggingService.debug(
        `getQueue returning queue ${PERIPHERAL_COMMANDS_QUEUE.NAME}`,
        context,
      );
      return this.queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error accessing queue ${PERIPHERAL_COMMANDS_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private initializeQueue(): Queue<PeripheralCommandJobPayload, void, string> {
    const context = 'PeripheralQueueService.initializeQueue';
    this.loggingService.debug('Entering initializeQueue', context);

    try {
      const queue: Queue<PeripheralCommandJobPayload, void, string> =
        this.queueService.getQueue(PERIPHERAL_COMMANDS_QUEUE.NAME);

      this.loggingService.debug(
        `initializeQueue returning queue ${PERIPHERAL_COMMANDS_QUEUE.NAME}`,
        context,
      );
      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error initializing queue ${PERIPHERAL_COMMANDS_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
