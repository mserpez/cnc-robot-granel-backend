import { Inject, Injectable, Optional } from '@nestjs/common';
import { LoggingService } from '../../core';
import {
  AXIS_EVENT_KEYS,
  HARDWARE_USB_TRANSPORT,
  MOTOR_COMMAND_KEYS,
  SENSOR_EVENT_KEYS,
  type AxisEventKey,
  type SensorEventKey,
} from './hardware-communication.constants';
import type {
  AxisHandlersMap,
  AxisMoveCallback,
  AxisPosition,
  MotorCommandPayload,
  SensorCallback,
  SensorHandlersMap,
  UsbInboundMessage,
  UsbOutboundMessage,
  UsbTransport,
} from './hardware-communication.types';

@Injectable()
export class HardwareCommunicationService {
  private readonly axisHandlers: AxisHandlersMap = new Map();
  private readonly sensorHandlers: SensorHandlersMap = new Map();

  constructor(
    private readonly loggingService: LoggingService,
    @Optional()
    @Inject(HARDWARE_USB_TRANSPORT)
    private readonly usbTransport?: UsbTransport,
  ) {}

  // -------- Motor command helpers --------
  async moveYToHopper(hopperIndex: number): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Y_TO_HOPPER,
      value: hopperIndex,
    });
  }

  async moveXToCenter(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER,
    });
  }

  async moveXToLeft(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_LEFT,
    });
  }

  async moveXToRight(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_TO_RIGHT,
    });
  }

  async moveZLeftRotation(rotations: number): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Z_LEFT_ROTATION,
      value: rotations,
    });
  }

  async moveZRightRotation(rotations: number): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Z_RIGHT_ROTATION,
      value: rotations,
    });
  }

  async moveAOpen(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_OPEN,
    });
  }

  async moveAClose(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_CLOSE,
    });
  }

  async moveYHome(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_Y_HOME,
    });
  }

  async moveXHome(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_X_HOME,
    });
  }

  async moveAHome(): Promise<void> {
    await this.executeMotorCommand({
      command: MOTOR_COMMAND_KEYS.MOVE_A_HOME,
    });
  }

  async tareScale(): Promise<void> {
    const context = 'HardwareCommunicationService.tareScale';
    this.loggingService.debug('Sending TARE_SCALE command', context);

    await this.sendCommand('TARE_SCALE');
  }

  // -------- Axis positions --------
  async getXAxisPosition(): Promise<AxisPosition> {
    return this.readAxisPosition('X');
  }

  async getYAxisPosition(): Promise<AxisPosition> {
    return this.readAxisPosition('Y');
  }

  async getAAxisPosition(): Promise<AxisPosition> {
    return this.readAxisPosition('A');
  }

  // -------- Axis move callbacks --------
  onYAxisMoveCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.Y_AXIS_MOVE_COMPLETED, callback);
  }

  onXAxisMoveCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.X_AXIS_MOVE_COMPLETED, callback);
  }

  onAAxisMoveCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.A_AXIS_MOVE_COMPLETED, callback);
  }

  onZAxisMoveCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.Z_AXIS_MOVE_COMPLETED, callback);
  }

  onYAxisHomeCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.Y_AXIS_HOME_COMPLETED, callback);
  }

  onXAxisHomeCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.X_AXIS_HOME_COMPLETED, callback);
  }

  onAAxisHomeCompleted(callback: AxisMoveCallback): void {
    this.registerAxisHandler(AXIS_EVENT_KEYS.A_AXIS_HOME_COMPLETED, callback);
  }

  // -------- Sensor callbacks --------
  onYAxisSensitiveSensor(callback: SensorCallback): void {
    this.registerSensorHandler(SENSOR_EVENT_KEYS.Y_AXIS_SENSITIVE, callback);
  }

  onXAxisSensitiveSensor(callback: SensorCallback): void {
    this.registerSensorHandler(SENSOR_EVENT_KEYS.X_AXIS_SENSITIVE, callback);
  }

  // -------- Sensor readings --------
  async getCurrentWeight(): Promise<number> {
    const context = 'HardwareCommunicationService.getCurrentWeight';
    this.loggingService.debug('Reading current weight from hardware', context);

    try {
      const response = await this.sendCommand('GET_CURRENT_WEIGHT');
      const weight =
        typeof response.data?.weight === 'number' ? response.data.weight : 0;
      return weight;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error('Error reading current weight', trace, context);
      throw error;
    }
  }

  // -------- Event emitters (to be used by USB listener) --------
  emitAxisEvent(key: AxisEventKey, positionMm: number): void {
    const context = 'HardwareCommunicationService.emitAxisEvent';
    this.loggingService.debug(
      `Emitting axis event ${key} with position ${positionMm}mm`,
      context,
    );
    const handlers = this.axisHandlers.get(key);
    handlers?.forEach((handler) => handler({ positionMm }));
  }

  emitSensorEvent(key: SensorEventKey, payload: unknown): void {
    const context = 'HardwareCommunicationService.emitSensorEvent';
    this.loggingService.debug(
      `Emitting sensor event ${key} with payload ${JSON.stringify(payload)}`,
      context,
    );
    const handlers = this.sensorHandlers.get(key);
    handlers?.forEach((handler) => handler(payload));
  }

  // -------- Low-level USB helpers --------
  async sendCommand(
    command: string,
    payload: UsbOutboundMessage['payload'] = {},
  ): Promise<UsbInboundMessage> {
    const context = 'HardwareCommunicationService.sendCommand';
    this.loggingService.debug(
      `Sending command ${command}${
        Object.keys(payload).length
          ? ` with payload ${JSON.stringify(payload)}`
          : ''
      }`,
      context,
    );

    try {
      const transport = await this.ensureTransport(context);
      const message: UsbOutboundMessage = { command, payload };
      await transport.write(message);
      this.loggingService.debug(
        `Command ${command} written to USB transport`,
        context,
      );

      const response = await transport.read();
      this.loggingService.debug(
        `Command ${command} received response with status ${response.status}`,
        context,
      );

      return response;
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Failed to send command ${command}`,
        trace,
        context,
      );
      throw error;
    }
  }

  private async ensureTransport(context: string): Promise<UsbTransport> {
    if (!this.usbTransport) {
      const error = new Error('USB transport is not configured');
      this.loggingService.error(error.message, error.stack, context);
      throw error;
    }

    if (!this.usbTransport.isOpen()) {
      this.loggingService.debug(
        'USB transport not open. Attempting to open.',
        context,
      );
      await this.usbTransport.open();
      this.loggingService.debug('USB transport opened', context);
    }

    return this.usbTransport;
  }

  private async executeMotorCommand(
    payload: MotorCommandPayload,
  ): Promise<UsbInboundMessage> {
    const commandPayload =
      payload.value !== undefined ? { value: payload.value } : {};
    return this.sendCommand(payload.command, commandPayload);
  }

  private async readAxisPosition(axis: 'X' | 'Y' | 'A'): Promise<AxisPosition> {
    const context = `HardwareCommunicationService.readAxisPosition(${axis})`;
    this.loggingService.debug(`Reading axis ${axis} position`, context);

    try {
      const response = await this.sendCommand('GET_AXIS_POSITION', { axis });
      const position =
        typeof response.data?.positionMm === 'number'
          ? response.data.positionMm
          : 0;
      return { positionMm: position };
    } catch (error) {
      const trace = error instanceof Error ? error.stack : String(error);
      this.loggingService.error(
        `Error reading axis ${axis} position`,
        trace,
        context,
      );
      throw error;
    }
  }

  private registerAxisHandler(
    key: AxisEventKey,
    callback: AxisMoveCallback,
  ): void {
    if (!this.axisHandlers.has(key)) {
      this.axisHandlers.set(key, new Set());
    }
    this.axisHandlers.get(key)?.add(callback);
  }

  private registerSensorHandler(
    key: SensorEventKey,
    callback: SensorCallback,
  ): void {
    if (!this.sensorHandlers.has(key)) {
      this.sensorHandlers.set(key, new Set());
    }
    this.sensorHandlers.get(key)?.add(callback);
  }
}
