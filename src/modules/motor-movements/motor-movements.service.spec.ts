import type { JobsOptions, Queue } from 'bullmq';
import { MOTOR_MOVEMENTS_QUEUE } from '../../constants';
import type { LoggingService, QueueService } from '../../core';
import { MotorMovementsQueueService } from './motor-movements-queue.service';
import { MotorMovementsService } from './motor-movements.service';
import type { MotorMovementJobPayload } from './motor-movements.types';

type QueueAddReturn = ReturnType<
  Queue<MotorMovementJobPayload, void, string>['add']
>;

type QueueAddMock = jest.Mock<
  QueueAddReturn,
  Parameters<Queue<MotorMovementJobPayload, void, string>['add']>
>;

type WaitUntilFinishedMock = jest.Mock<Promise<unknown>, [unknown]>;

const createLoggingStub = (): LoggingService =>
  ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggingService;

const createPayload = (): MotorMovementJobPayload => ({
  command: 'MOVE_Z_RIGHT_ROTATION',
  params: { rotations: 1 },
});

describe('MotorMovementsService', () => {
  let loggingStub: LoggingService;
  let queueAddMock: QueueAddMock;
  let waitUntilFinishedMock: WaitUntilFinishedMock;
  let getQueueMock: jest.Mock<Queue<MotorMovementJobPayload, void, string>>;
  let getQueueEventsMock: jest.Mock<unknown, [string]>;

  let queueStub: Queue<MotorMovementJobPayload, void, string>;
  let queueServiceStub: MotorMovementsQueueService;
  let queueManagerStub: QueueService;
  let service: MotorMovementsService;

  beforeEach(() => {
    loggingStub = createLoggingStub();

    waitUntilFinishedMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue(undefined);

    queueAddMock = jest
      .fn<QueueAddReturn, Parameters<Queue<any>['add']>>()
      .mockImplementation((name, data, opts) =>
        Promise.resolve({
          id: 'job-123',
          name,
          data,
          opts,
          waitUntilFinished: waitUntilFinishedMock,
        } as unknown as Awaited<QueueAddReturn>),
      );

    queueStub = {
      name: MOTOR_MOVEMENTS_QUEUE.NAME,
      add: queueAddMock,
    } as unknown as Queue<MotorMovementJobPayload, void, string>;

    getQueueMock = jest.fn().mockReturnValue(queueStub);
    getQueueEventsMock = jest.fn().mockReturnValue({});

    queueServiceStub = {
      getQueue: getQueueMock,
    } as unknown as MotorMovementsQueueService;

    queueManagerStub = {
      getQueueEvents: getQueueEventsMock,
    } as unknown as QueueService;

    service = new MotorMovementsService(
      queueServiceStub,
      loggingStub,
      queueManagerStub,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues the command and waits for completion', async () => {
    const payload = createPayload();

    await service.enqueueCommand(payload);

    expect(getQueueMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock).toHaveBeenCalledWith(
      MOTOR_MOVEMENTS_QUEUE.JOBS.COMMAND,
      payload,
      expect.objectContaining({
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );
    expect(getQueueEventsMock).toHaveBeenCalledWith(MOTOR_MOVEMENTS_QUEUE.NAME);
    expect(waitUntilFinishedMock).toHaveBeenCalledWith({});
  });

  it('overrides job options when provided', async () => {
    const payload = createPayload();
    const options: JobsOptions = { removeOnComplete: true };

    await service.enqueueCommand(payload, options);

    expect(queueAddMock).toHaveBeenCalledWith(
      MOTOR_MOVEMENTS_QUEUE.JOBS.COMMAND,
      payload,
      expect.objectContaining({
        removeOnComplete: true,
        removeOnFail: false,
      }),
    );
  });

  it('propagates errors when the job fails to complete', async () => {
    const payload = createPayload();
    const failure = new Error('movement failed');

    waitUntilFinishedMock.mockRejectedValueOnce(failure);

    await expect(service.enqueueCommand(payload)).rejects.toThrow(
      'movement failed',
    );

    expect(queueAddMock).toHaveBeenCalled();
    expect(getQueueEventsMock).toHaveBeenCalled();
  });
});
