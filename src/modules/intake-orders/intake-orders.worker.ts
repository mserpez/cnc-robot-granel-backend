import { Injectable, OnModuleInit } from '@nestjs/common';
import { ORDER_INTAKE_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { PrepareOrderJobPayload } from '../prepare-orders';
import { PrepareOrdersService } from '../prepare-orders';

@Injectable()
export class IntakeOrdersWorker implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly prepareOrdersService: PrepareOrdersService,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    this.queueService.createWorker<PrepareOrderJobPayload>(
      ORDER_INTAKE_QUEUE.NAME,
      async (job) => {
        const context = 'IntakeOrdersWorker';
        this.loggingService.debug(
          `Processing intake order job ${job.id}`,
          context,
        );
        await this.prepareOrdersService.enqueuePrepareOrder(job.data);
      },
    );
  }
}
