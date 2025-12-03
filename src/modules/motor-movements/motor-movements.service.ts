import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { MOTOR_MOVEMENTS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import { MotorMovementsQueueService } from './motor-movements-queue.service';
import type { MotorMovementJobPayload } from './motor-movements.types';

@Injectable()
export class MotorMovementsService {
  constructor(
    private readonly queueService: MotorMovementsQueueService,
    private readonly loggingService: LoggingService,
    private readonly queueManager: QueueService,
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

      const jobOptions: JobsOptions = {
        removeOnComplete: options?.removeOnComplete ?? false,
        removeOnFail: options?.removeOnFail ?? false,
        ...options,
      };

      const job = await queue.add(
        MOTOR_MOVEMENTS_QUEUE.JOBS.COMMAND,
        payload,
        jobOptions,
      );
      const queueEvents = this.queueManager.getQueueEvents(queue.name);

      await new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          reject(
            new Error(
              `Motor command ${payload.command} timed out after ${MOTOR_MOVEMENTS_QUEUE.DEFAULT_TIMEOUT_MS}ms`,
            ),
          );
        }, MOTOR_MOVEMENTS_QUEUE.DEFAULT_TIMEOUT_MS);

        job
          .waitUntilFinished(queueEvents)
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timeoutHandle));
      });

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
