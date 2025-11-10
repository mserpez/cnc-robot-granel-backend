import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { MOTOR_COMMAND_JOB_NAME } from '../../constants';
import { LoggingService } from '../../core';
import { MotorMovementsQueueService } from './motor-movements-queue.service';
import type { MotorMovementJobPayload } from './motor-movements.types';

@Injectable()
export class MotorMovementsService {
  constructor(
    private readonly queueService: MotorMovementsQueueService,
    private readonly loggingService: LoggingService,
  ) {}

  async enqueueCommand(
    payload: MotorMovementJobPayload,
    options?: JobsOptions,
  ): Promise<void> {
    const context = 'MotorMovementsService.enqueueCommand';
    this.loggingService.debug(
      `Queueing motor command ${payload.command}`,
      context,
    );

    try {
      const queue: Queue<MotorMovementJobPayload, void, string> =
        this.queueService.getQueue();

      await queue.add(MOTOR_COMMAND_JOB_NAME, payload, options);

      this.loggingService.debug(
        `Motor command ${payload.command} enqueued`,
        context,
      );
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error enqueuing motor command ${payload.command}`,
        trace,
        context,
      );
      throw error;
    }
  }
}
