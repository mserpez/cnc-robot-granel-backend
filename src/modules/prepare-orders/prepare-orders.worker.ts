import { Injectable, OnModuleInit } from '@nestjs/common';
import { PREPARE_ORDERS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import { PrepareOrdersService } from './prepare-orders.service';
import type { PrepareOrderJobPayload } from './prepare-orders.types';

@Injectable()
export class PrepareOrdersWorker implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly prepareOrdersService: PrepareOrdersService,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    this.queueService.createWorker<PrepareOrderJobPayload>(
      PREPARE_ORDERS_QUEUE,
      async (job) => {
        const context = 'PrepareOrdersWorker';
        this.loggingService.debug(
          `Processing prepare order job ${job.id}`,
          context,
        );
        await this.prepareOrdersService.processPrepareOrder(job.data);
      },
    );
  }
}
