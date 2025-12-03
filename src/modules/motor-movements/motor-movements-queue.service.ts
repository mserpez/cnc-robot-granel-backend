import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MOTOR_MOVEMENTS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { MotorMovementJobPayload } from './motor-movements.types';

@Injectable()
export class MotorMovementsQueueService {
  private readonly queue: Queue<MotorMovementJobPayload, void, string>;

  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {
    this.queue = this.initializeQueue();
  }

  getQueue(): Queue<MotorMovementJobPayload, void, string> {
    const context = 'MotorMovementsQueueService.getQueue';
    this.loggingService.debug('Entering getQueue', context);

    try {
      this.loggingService.debug(
        `getQueue returning queue ${MOTOR_MOVEMENTS_QUEUE.NAME}`,
        context,
      );
      return this.queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error accessing queue ${MOTOR_MOVEMENTS_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private initializeQueue(): Queue<MotorMovementJobPayload, void, string> {
    const context = 'MotorMovementsQueueService.initializeQueue';
    this.loggingService.debug('Entering initializeQueue', context);

    try {
      const queue: Queue<MotorMovementJobPayload, void, string> =
        this.queueService.getQueue(MOTOR_MOVEMENTS_QUEUE.NAME);

      this.loggingService.debug(
        `initializeQueue returning queue ${MOTOR_MOVEMENTS_QUEUE.NAME}`,
        context,
      );

      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error initializing queue ${MOTOR_MOVEMENTS_QUEUE.NAME}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
