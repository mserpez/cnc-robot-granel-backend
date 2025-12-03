import { Injectable, OnModuleInit } from '@nestjs/common';
import { ORDER_PREPARE_QUEUE } from '../../constants';
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
      ORDER_PREPARE_QUEUE.NAME,
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
