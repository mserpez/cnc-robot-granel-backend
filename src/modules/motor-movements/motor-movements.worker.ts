import { Injectable, OnModuleInit } from '@nestjs/common';
import { MOTOR_MOVEMENTS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import type { MotorMovementJobPayload } from './motor-movements.types';

@Injectable()
export class MotorMovementsWorker implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    this.queueService.createWorker<MotorMovementJobPayload>(
      MOTOR_MOVEMENTS_QUEUE.NAME,
      async (job) => {
        const context = 'MotorMovementsWorker';
        this.loggingService.debug(
          `Processing motor command ${job.data.command}`,
          context,
        );

        await this.executeCommand(job.data);
      },
    );
  }

  private executeCommand(payload: MotorMovementJobPayload): Promise<void> {
    this.loggingService.debug(
      `Executing motor command ${payload.command}`,
      'MotorMovementsWorker.executeCommand',
    );

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
    // switch (payload.command) {
    //   case MOTOR_COMMAND_KEYS.MOVE_Y_TO_HOPPER:
    //     await this.hardware.moveYToHopper(
    //       Number(payload.params?.hopperId ?? payload.params?.hopperIndex ?? 0),
    //     );
    //     this.hardware.emitAxisEvent(
    //       AXIS_EVENT_KEYS.Y_AXIS_MOVE_COMPLETED,
    //       Number(payload.params?.positionMm ?? 0),
    //     );
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER:
    //     await this.hardware.moveXToCenter();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.X_AXIS_MOVE_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_X_TO_LEFT:
    //     await this.hardware.moveXToLeft();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.X_AXIS_MOVE_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_X_TO_RIGHT:
    //     await this.hardware.moveXToRight();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.X_AXIS_MOVE_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_Z_LEFT_ROTATION:
    //     await this.hardware.moveZLeftRotation(
    //       Number(payload.params?.rotations ?? 0),
    //     );
    //     this.hardware.emitAxisEvent(
    //       AXIS_EVENT_KEYS.Z_AXIS_MOVE_COMPLETED,
    //       Number(payload.params?.positionMm ?? 0),
    //     );
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_Z_RIGHT_ROTATION:
    //     await this.hardware.moveZRightRotation(
    //       Number(payload.params?.rotations ?? 0),
    //     );
    //     this.hardware.emitAxisEvent(
    //       AXIS_EVENT_KEYS.Z_AXIS_MOVE_COMPLETED,
    //       Number(payload.params?.positionMm ?? 0),
    //     );
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_A_OPEN:
    //     await this.hardware.moveAOpen();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.A_AXIS_MOVE_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_A_CLOSE:
    //     await this.hardware.moveAClose();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.A_AXIS_MOVE_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_Y_HOME:
    //     await this.hardware.moveYHome();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.Y_AXIS_HOME_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_X_HOME:
    //     await this.hardware.moveXHome();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.X_AXIS_HOME_COMPLETED, 0);
    //     break;
    //   case MOTOR_COMMAND_KEYS.MOVE_A_HOME:
    //     await this.hardware.moveAHome();
    //     this.hardware.emitAxisEvent(AXIS_EVENT_KEYS.A_AXIS_HOME_COMPLETED, 0);
    //     break;
    //   default:
    //     this.loggingService.warn(
    //       `Unknown motor command ${(payload.command as MotorCommandKey) ?? 'undefined'}`,
    //       'MotorMovementsWorker.executeCommand',
    //     );
    // }
  }
}
