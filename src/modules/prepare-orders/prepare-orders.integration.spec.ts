import { Job, Queue } from 'bullmq';
import Redis from 'ioredis-mock';
import { ORDER_PREPARE_QUEUE } from '../../constants';
import type { LoggingService } from '../../core';
import type { QueueService } from '../../core/queue/queue.service';
import type { HardwareCommunicationService } from '../hardware-communication';
import type { MotorMovementsService } from '../motor-movements';
import { PrepareOrdersQueueService } from './prepare-orders-queue.service';
import { PrepareOrdersService } from './prepare-orders.service';
import type { PrepareOrderJobPayload } from './prepare-orders.types';

type QueueAddSpy = jest.SpyInstance<
  ReturnType<Queue<PrepareOrderJobPayload, void, string>['add']>,
  Parameters<Queue<PrepareOrderJobPayload, void, string>['add']>
>;

const createLoggingStub = (): LoggingService =>
  ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggingService;

type RedisInstance = InstanceType<typeof Redis>;

describe('PrepareOrdersService enqueue integration', () => {
  let redis: RedisInstance;
  let queue: Queue<PrepareOrderJobPayload, void, string>;
  let service: PrepareOrdersService;
  let queueAddSpy: QueueAddSpy;

  beforeEach(() => {
    redis = new Redis();
    queue = new Queue<PrepareOrderJobPayload, void, string>(
      ORDER_PREPARE_QUEUE.NAME,
      { connection: redis as unknown as RedisInstance },
    );

    queueAddSpy = jest
      .spyOn(queue, 'add')
      .mockImplementation((name, data, options) =>
        Promise.resolve({
          name,
          data,
          opts: options,
        } as unknown as Job<PrepareOrderJobPayload, void, string>),
      );

    const loggingStub = createLoggingStub();
    const queueServiceStub = {
      getQueue: jest.fn().mockReturnValue(queue),
    } as unknown as QueueService;

    const prepareQueueService = new PrepareOrdersQueueService(
      queueServiceStub,
      loggingStub,
    );

    const motorMovementsStub = {
      enqueueCommand: jest.fn(),
    } as unknown as MotorMovementsService;
    const hardwareStub = {
      getCurrentWeight: jest.fn(),
    } as unknown as HardwareCommunicationService;

    service = new PrepareOrdersService(
      prepareQueueService,
      motorMovementsStub,
      hardwareStub,
      loggingStub,
    );
  });

  afterEach(async () => {
    queueAddSpy.mockRestore();
    await queue.close();
    redis.disconnect();
    jest.clearAllMocks();
  });

  it('enqueues a prepare order job on the main queue', async () => {
    const payload: PrepareOrderJobPayload = {
      productId: 'product-123',
      orderId: 'order-123',
      hopperId: 'hopper-1',
      weightGrams: 250,
    };

    await service.enqueuePrepareOrder(payload);

    expect(queueAddSpy).toHaveBeenCalledWith(
      ORDER_PREPARE_QUEUE.JOBS.PREPARE_ORDER,
      payload,
      expect.objectContaining({
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );
  });
});
