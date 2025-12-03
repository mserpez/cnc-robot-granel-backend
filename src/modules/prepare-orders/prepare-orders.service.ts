import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { ORDER_PREPARE_QUEUE } from '../../constants';
import { LoggingService } from '../../core';
import {
  HardwareCommunicationService,
  MOTOR_COMMAND_KEYS,
} from '../hardware-communication';
import { MotorMovementsService } from '../motor-movements';
import { PrepareOrdersQueueService } from './prepare-orders-queue.service';
import type { PrepareOrderJobPayload } from './prepare-orders.types';

@Injectable()
export class PrepareOrdersService {
  private readonly DISPENSE_PHASES: number[] = [0.9, 0.07, 0.02, 0.01];

  constructor(
    private readonly queueService: PrepareOrdersQueueService,
    private readonly motorMovements: MotorMovementsService,
    private readonly hardware: HardwareCommunicationService,
    private readonly loggingService: LoggingService,
  ) {}

  async enqueuePrepareOrder(
    payload: PrepareOrderJobPayload,
    options?: JobsOptions,
  ): Promise<void> {
    const context = 'PrepareOrdersService.enqueuePrepareOrder';
    this.loggingService.debug(
      `Queueing prepare order job for order ${payload.orderId}`,
      context,
    );

    const queue: Queue<PrepareOrderJobPayload, void, string> =
      this.queueService.getQueue();

    const jobOptions: JobsOptions = {
      removeOnComplete: options?.removeOnComplete ?? false,
      removeOnFail: options?.removeOnFail ?? false,
      ...options,
    };

    await queue.add(
      ORDER_PREPARE_QUEUE.JOBS.PREPARE_ORDER,
      payload,
      jobOptions,
    );
  }

  async processPrepareOrder(payload: PrepareOrderJobPayload): Promise<void> {
    const context = 'PrepareOrdersService.processPrepareOrder';
    this.loggingService.debug(
      `Processing order ${payload.orderId} with target ${payload.weightGrams}g`,
      context,
    );

    await this.homeAxes();
    await this.moveToHopper(payload.hopperId);
    await this.closeDispenserGate();
    await this.performDispenseRoutine(payload);
    await this.returnToSafeState();

    this.loggingService.debug(`Order ${payload.orderId} completed`, context);
  }

  private async homeAxes(): Promise<void> {
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_HOME,
    });
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_HOME,
    });
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER,
    });
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Y_HOME,
    });
  }

  private async moveToHopper(hopperId: string): Promise<void> {
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER,
    });
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Y_TO_HOPPER,
      params: { hopperId },
    });
  }

  private async closeDispenserGate(): Promise<void> {
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_CLOSE,
    });
  }

  private async performDispenseRoutine(
    payload: PrepareOrderJobPayload,
  ): Promise<void> {
    const context = 'PrepareOrdersService.performDispenseRoutine';

    await this.connectXAxisToHopper();

    const weightPerTurn = await this.rotateAndMeasure(1, 'initial-turn');

    if (weightPerTurn <= 0) {
      throw new Error(
        'Initial calibration failed: weight per rotation is zero',
      );
    }

    const targetWeight = payload.weightGrams;
    let dispensed = weightPerTurn;

    const initialFraction = weightPerTurn / targetWeight;

    this.loggingService.debug(
      `Initial turn dispensed ${weightPerTurn}g (${(
        initialFraction * 100
      ).toFixed(2)}%)`,
      context,
    );

    const phases = this.buildPhases(initialFraction);

    for (const phase of phases) {
      const remaining = targetWeight - dispensed;
      if (remaining <= 0) {
        break;
      }

      const targetPortion = targetWeight * phase;
      const toDispense = Math.min(targetPortion, remaining);
      if (toDispense <= 0) {
        continue;
      }

      const rotationsNeeded = toDispense / weightPerTurn;
      await this.rotateAndMeasure(rotationsNeeded, `phase-${phase}`);
      dispensed = await this.hardware.getCurrentWeight();
      this.loggingService.debug(
        `Dispensed ${dispensed.toFixed(2)}g / ${targetWeight}g`,
        context,
      );
    }

    await this.openDispenserGate();
  }

  private buildPhases(initialFraction: number): number[] {
    const ninetyPercent = 0.9 - initialFraction;
    const adjustedNinety = ninetyPercent > 0 ? ninetyPercent : 0;
    return [adjustedNinety, ...this.DISPENSE_PHASES.slice(1)];
  }

  private async connectXAxisToHopper(): Promise<void> {
    // TODO: It could be left or right, depending on the hopper position
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_RIGHT,
    });
    await this.hardware.tareScale();
  }

  private async rotateAndMeasure(
    rotations: number,
    label: string,
  ): Promise<number> {
    const context = `PrepareOrdersService.rotateAndMeasure(${label})`;
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Z_RIGHT_ROTATION,
      params: { rotations },
    });
    const weight = await this.hardware.getCurrentWeight();
    this.loggingService.debug(`${label}: measured ${weight}g`, context);
    return weight;
  }

  private async openDispenserGate(): Promise<void> {
    const context = 'PrepareOrdersService.openDispenserGate';
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_OPEN,
    });

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const weight = await this.hardware.getCurrentWeight();

      if (weight <= 0) {
        this.loggingService.debug(
          'Scale indicates zero weight, closing dispenser gate',
          context,
        );
        await this.motorMovements.enqueueCommand({
          command: MOTOR_COMMAND_KEYS.MOVE_A_CLOSE,
        });
        return;
      }

      this.loggingService.debug(
        `Scale still reports ${weight}g (attempt ${attempt}/${maxRetries})`,
        context,
      );
    }

    throw new Error(
      'Dispenser gate timeout: scale never reached zero after 5 attempts',
    );
  }

  private async returnToSafeState(): Promise<void> {
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER,
    });
    await this.motorMovements.enqueueCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_CLOSE,
    });
  }
}
