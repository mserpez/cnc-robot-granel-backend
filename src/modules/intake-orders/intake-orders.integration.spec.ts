import { Job, Queue } from 'bullmq';
import Redis from 'ioredis-mock';
import { ORDER_INTAKE_QUEUE } from '../../constants';
import type { LoggingService } from '../../core';
import type { QueueService } from '../../core/infrastructure/queue/queue.service';
import type { PrepareOrderJobPayload } from '../prepare-orders';
import { IntakeOrdersQueueService } from './intake-orders-queue.service';
import { IntakeOrdersService } from './intake-orders.service';

type RedisInstance = InstanceType<typeof Redis>;

const createLoggingStub = (): LoggingService =>
  ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggingService;

type QueueAddSpy = jest.SpyInstance<
  ReturnType<Queue<PrepareOrderJobPayload, void, string>['add']>,
  Parameters<Queue<PrepareOrderJobPayload, void, string>['add']>
>;

describe('IntakeOrdersService enqueue integration', () => {
  let redis: RedisInstance;
  let queue: Queue<PrepareOrderJobPayload, void, string>;
  let service: IntakeOrdersService;
  let queueAddSpy: QueueAddSpy;

  beforeEach(() => {
    redis = new Redis();
    queue = new Queue<PrepareOrderJobPayload, void, string>(
      ORDER_INTAKE_QUEUE.NAME,
      { connection: redis as unknown as RedisInstance },
    );

    queueAddSpy = jest
      .spyOn(queue, 'add')
      .mockImplementation((name, data, options) =>
        Promise.resolve({
          id: 'job-123',
          name,
          data,
          opts: options,
        } as unknown as Job<PrepareOrderJobPayload, void, string>),
      );

    const loggingStub = createLoggingStub();
    const queueServiceStub = {
      getQueue: jest.fn().mockReturnValue(queue),
    } as unknown as QueueService;

    const intakeQueueService = new IntakeOrdersQueueService(
      queueServiceStub,
      loggingStub,
    );

    service = new IntakeOrdersService(intakeQueueService, loggingStub);
  });

  afterEach(async () => {
    queueAddSpy.mockRestore();
    await queue.close();
    redis.disconnect();
    jest.clearAllMocks();
  });

  it('enqueues an intake order job and returns metadata', async () => {
    const payload: PrepareOrderJobPayload = {
      productId: 'product-123',
      orderId: 'order-456',
      hopperId: 'hopper-1',
      weightGrams: 250,
    };

    const result = await service.enqueueOrder(payload);

    expect(queueAddSpy).toHaveBeenCalledWith(
      ORDER_INTAKE_QUEUE.JOBS.ENQUEUE_ORDER,
      payload,
      expect.objectContaining({
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );

    expect(result).toEqual({
      queue: ORDER_INTAKE_QUEUE.NAME,
      jobId: 'job-123',
    });
  });
});
