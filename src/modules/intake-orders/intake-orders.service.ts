import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ORDER_INTAKE_QUEUE } from '../../constants';
import { LoggingService } from '../../core';
import type { PrepareOrderJobPayload } from '../prepare-orders';
import { IntakeOrdersQueueService } from './intake-orders-queue.service';

@Injectable()
export class IntakeOrdersService {
  constructor(
    private readonly queueService: IntakeOrdersQueueService,
    private readonly loggingService: LoggingService,
  ) {}

  async enqueueOrder(payload: PrepareOrderJobPayload): Promise<{
    queue: string;
    jobId: string | number | undefined;
  }> {
    const context = 'IntakeOrdersService.enqueueOrder';
    const queue: Queue<PrepareOrderJobPayload, void, string> =
      this.queueService.getQueue();

    this.loggingService.debug(
      `Enqueuing order ${payload.orderId} in ${queue.name}`,
      context,
    );

    const job = await queue.add(
      ORDER_INTAKE_QUEUE.JOBS.ENQUEUE_ORDER,
      payload,
      {
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.loggingService.debug(
      `Order ${payload.orderId} enqueued with job ${job.id}`,
      context,
    );

    return { queue: queue.name, jobId: job.id };
  }
}
