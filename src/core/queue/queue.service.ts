import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Processor,
  Queue,
  QueueEvents,
  QueueOptions,
  Worker,
  WorkerOptions,
} from 'bullmq';
import { LoggingService } from '../logging/logging.service';

type ConnectionOptions = NonNullable<QueueOptions['connection']>;
type QueueProcessor<DataType = unknown, ResultType = unknown> = Processor<
  DataType,
  ResultType,
  string
>;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connectionOptions: ConnectionOptions;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Set<Worker<any, any, string>>();
  private readonly queueEvents = new Map<string, QueueEvents>();

  constructor(
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {
    this.connectionOptions = this.resolveConnectionOptions();
  }

  getQueue(name: string, options?: QueueOptions): Queue {
    const context = 'QueueService.getQueue';
    this.loggingService.debug(
      `Entering getQueue with params ${JSON.stringify({
        name,
        hasOptions: Boolean(options),
      })}`,
      context,
    );

    try {
      if (this.queues.has(name)) {
        const existing: Queue = this.queues.get(name) as Queue;
        this.loggingService.debug(
          `getQueue returning existing queue ${name}`,
          context,
        );
        return existing;
      }

      const queue: Queue = this.createQueue(name, options);
      this.loggingService.debug(
        `getQueue returning new queue ${name}`,
        context,
      );
      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error in getQueue for ${name}`,
        trace,
        context,
      );
      throw error;
    }
  }

  createQueue(name: string, options?: QueueOptions): Queue {
    const context = 'QueueService.createQueue';
    this.loggingService.debug(
      `Entering createQueue with params ${JSON.stringify({
        name,
        hasOptions: Boolean(options),
      })}`,
      context,
    );

    try {
      const queueOptions: QueueOptions = {
        connection: this.connectionOptions,
        ...options,
      };

      const queue: Queue = new Queue(name, queueOptions);
      this.queues.set(name, queue);

      this.loggingService.debug(`createQueue returning queue ${name}`, context);

      return queue;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(`Error creating queue ${name}`, trace, context);
      throw error;
    }
  }

  createWorker<DataType = unknown, ResultType = unknown>(
    name: string,
    processor: QueueProcessor<DataType, ResultType>,
    options?: WorkerOptions,
  ): Worker<DataType, ResultType, string> {
    const context = 'QueueService.createWorker';
    this.loggingService.debug(
      `Entering createWorker with params ${JSON.stringify({
        name,
        hasOptions: Boolean(options),
      })}`,
      context,
    );

    try {
      const workerOptions: WorkerOptions = {
        connection: this.connectionOptions,
        ...options,
      };

      const worker: Worker<DataType, ResultType, string> = new Worker<
        DataType,
        ResultType,
        string
      >(name, processor, workerOptions);
      this.workers.add(worker);

      this.loggingService.debug(
        `createWorker returning worker for ${name}`,
        context,
      );

      return worker;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error creating worker for ${name}`,
        trace,
        context,
      );
      throw error;
    }
  }

  getRegisteredQueues(): Queue[] {
    const context = 'QueueService.getRegisteredQueues';
    this.loggingService.debug('Entering getRegisteredQueues', context);

    try {
      const queues: Queue[] = Array.from(this.queues.values());
      this.loggingService.debug(
        `getRegisteredQueues returning ${queues.length} queues`,
        context,
      );
      return queues;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        'Error retrieving registered queues',
        trace,
        context,
      );
      throw error;
    }
  }

  getQueueEvents(name: string): QueueEvents {
    if (!this.queueEvents.has(name)) {
      const queueEvents = new QueueEvents(name, {
        connection: this.connectionOptions,
      });
      this.queueEvents.set(name, queueEvents);
    }
    return this.queueEvents.get(name) as QueueEvents;
  }

  async onModuleDestroy(): Promise<void> {
    const context = 'QueueService.onModuleDestroy';
    this.loggingService.debug(
      'Entering onModuleDestroy to close queues and workers',
      context,
    );

    try {
      await Promise.all(
        Array.from(this.workers).map((worker: Worker<any, any, string>) =>
          worker.close(),
        ),
      );
      await Promise.all(
        Array.from(this.queues.values()).map((queue) => queue.close()),
      );
      await Promise.all(
        Array.from(this.queueEvents.values()).map((queueEvent) =>
          queueEvent.close(),
        ),
      );

      this.loggingService.debug(
        'onModuleDestroy completed closing queues and workers',
        context,
      );
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        'Error during onModuleDestroy in QueueService',
        trace,
        context,
      );
      throw error;
    }
  }

  private resolveConnectionOptions(): ConnectionOptions {
    const context = 'QueueService.resolveConnectionOptions';
    this.loggingService.debug('Entering resolveConnectionOptions', context);

    try {
      const host = this.configService.get<string>('REDIS_HOST') ?? '127.0.0.1';
      const portValue = this.configService.get<string>('REDIS_PORT') ?? '6379';
      const parsedPort = parseInt(portValue, 10);
      const port = Number.isNaN(parsedPort) ? 6379 : parsedPort;
      const username = this.configService.get<string>('REDIS_USERNAME');
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const dbValue = this.configService.get<string>('REDIS_DB') ?? '0';
      const parsedDb = parseInt(dbValue, 10);
      const db = Number.isNaN(parsedDb) ? 0 : parsedDb;
      const tlsEnabled =
        this.configService.get<string>('REDIS_TLS_ENABLED') === 'true';

      const connection: ConnectionOptions = {
        host,
        port,
        db,
      };

      if (username) {
        connection.username = username;
      }

      if (password) {
        connection.password = password;
      }

      if (tlsEnabled) {
        connection.tls = {};
      }

      this.loggingService.debug(
        `resolveConnectionOptions returning ${JSON.stringify({
          host,
          port,
          db,
          hasUsername: Boolean(username),
          hasPassword: Boolean(password),
          tlsEnabled,
        })}`,
        context,
      );

      return connection;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        'Error resolving queue connection options',
        trace,
        context,
      );
      throw error;
    }
  }
}
