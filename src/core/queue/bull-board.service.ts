import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { INestApplication } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestHandler } from 'express';
import { LoggingService } from '../logging/logging.service';
import { QueueService } from './queue.service';

@Injectable()
export class BullBoardService {
  private mounted = false;

  constructor(
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {}

  mount(app: INestApplication): void {
    const context = 'BullBoardService.mount';
    this.loggingService.debug('Entering mount', context);

    try {
      if (this.mounted) {
        this.loggingService.debug('Bull Board already mounted', context);
        return;
      }

      const enabled =
        this.configService.get<string>('BULL_BOARD_ENABLED') === 'true';
      if (!enabled) {
        this.loggingService.debug(
          'Bull Board disabled by configuration',
          context,
        );
        return;
      }

      const basePath =
        this.configService.get<string>('BULL_BOARD_PATH') ?? '/admin/queues';

      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath(basePath);

      const queues = this.queueService.getRegisteredQueues().map(
        (queue) =>
          new BullMQAdapter(queue, {
            allowRetries: true,
          }),
      );

      createBullBoard({
        queues,
        serverAdapter,
      });

      const httpAdapter = app.getHttpAdapter();
      const router = serverAdapter.getRouter() as RequestHandler;
      httpAdapter.use(basePath, router);

      this.mounted = true;
      this.loggingService.log(
        `Bull Board mounted at http://localhost:${this.configService.get<string>('PORT')}${basePath}`,
        context,
      );
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error('Error mounting Bull Board', trace, context);
      throw error;
    }
  }
}
