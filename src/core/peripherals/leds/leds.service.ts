import { Injectable } from '@nestjs/common';
import { PeripheralType } from '@prisma/client';
import { PERIPHERAL_COMMANDS_QUEUE } from '../../../constants';
import { DeviceService } from '../../domain/device/device.service';
import { LoggingService } from '../../infrastructure/logging/logging.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PeripheralCoordinatorService } from '../peripheral-coordinator.service';
import type { SendCommandPayload } from '../peripheral-coordinator.types';
import { PeripheralQueueService } from '../peripheral-queue.service';
import type { LEDCommand, LEDConfig } from './leds.types';

@Injectable()
export class LEDService {
  constructor(
    private readonly coordinatorService: PeripheralCoordinatorService,
    private readonly queueService: PeripheralQueueService,
    private readonly deviceService: DeviceService,
    private readonly loggingService: LoggingService,
    private readonly mqttService: MqttService,
  ) {}

  /**
   * Crear un nuevo LED
   */
  async createLED(
    deviceUuid: string,
    componentId: string,
    config: LEDConfig,
  ): Promise<void> {
    const context = 'LEDService.createLED';

    // 1. Validar config
    this.validateLEDConfig(componentId, config);

    // 2. Obtener todos los periféricos existentes
    const existing = await this.coordinatorService.getPeripheralsByDevice(
      deviceUuid,
    );

    // 3. Verificar que no existe
    if (existing.find((p) => p.componentId === componentId)) {
      throw new Error(`LED ${componentId} already exists`);
    }

    // 4. Construir lista con existentes + nuevo
    const allPeripherals: Array<{
      componentId: string;
      type: string;
      config: Record<string, unknown>;
    }> = existing.map((p) => ({
      componentId: p.componentId,
      type: p.type,
      config: p.config as Record<string, unknown>,
    }));

    // Agregar el nuevo periférico
    allPeripherals.push({
      componentId,
      type: 'LED',
      config: config as unknown as Record<string, unknown>,
    });

    // 5. Enviar config completa a Arduino y esperar feedback
    const feedback = await this.mqttService.publishConfig(deviceUuid, {
      peripherals: allPeripherals,
    });

    // 6. Si feedback es success, crear en DB
    if (feedback.status === 'success') {
      const peripheralFeedback = feedback.peripherals?.find(
        (p) => p.componentId === componentId,
      );

      if (peripheralFeedback?.status === 'success') {
        await this.coordinatorService.createPeripheral(
          deviceUuid,
          componentId,
          PeripheralType.LED,
          config as unknown as Record<string, unknown>,
        );

        this.loggingService.log(
          `Created LED ${componentId} on device ${deviceUuid} (pin: ${config.pin})`,
          context,
        );
      } else {
        throw new Error(
          peripheralFeedback?.message ||
            'Configuration failed on Arduino',
        );
      }
    } else {
      throw new Error(
        feedback.message || 'Configuration failed on Arduino',
      );
    }
  }

  private validateLEDConfig(componentId: string, config: LEDConfig): void {
    if (!componentId || componentId.length === 0) {
      throw new Error('componentId cannot be empty');
    }
    if (componentId.length > 50) {
      throw new Error('componentId cannot exceed 50 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(componentId)) {
      throw new Error(
        'componentId can only contain alphanumeric characters, hyphens, and underscores',
      );
    }
    if (typeof config.pin !== 'number' || !Number.isInteger(config.pin)) {
      throw new Error('LED config must have a valid integer pin number');
    }
    if (config.pin < 0 || config.pin > 255) {
      throw new Error('LED pin must be between 0 and 255');
    }
  }

  /**
   * Actualizar configuración de un LED
   */
  async updateLED(
    deviceUuid: string,
    componentId: string,
    config: LEDConfig,
  ): Promise<void> {
    const context = 'LEDService.updateLED';

    // 1. Validar config
    this.validateLEDConfig(componentId, config);

    // 2. Obtener todos los periféricos existentes
    const existing = await this.coordinatorService.getPeripheralsByDevice(
      deviceUuid,
    );

    // 3. Verificar que existe
    const peripheral = existing.find((p) => p.componentId === componentId);
    if (!peripheral) {
      throw new Error(`LED ${componentId} not found`);
    }

    // 4. Construir lista con existentes, actualizando el que corresponde
    const allPeripherals: Array<{
      componentId: string;
      type: string;
      config: Record<string, unknown>;
    }> = existing.map((p) => ({
      componentId: p.componentId,
      type: p.type,
      config:
        p.componentId === componentId
          ? (config as unknown as Record<string, unknown>)
          : (p.config as Record<string, unknown>), // Actualizar solo el que corresponde
    }));

    // 5. Enviar config completa a Arduino (con el actualizado) y esperar feedback
    const feedback = await this.mqttService.publishConfig(deviceUuid, {
      peripherals: allPeripherals,
    });

    // 6. Si feedback es success, actualizar en DB
    if (feedback.status === 'success') {
      const peripheralFeedback = feedback.peripherals?.find(
        (p) => p.componentId === componentId,
      );

      if (peripheralFeedback?.status === 'success') {
        await this.coordinatorService.updatePeripheral(
          deviceUuid,
          componentId,
          config as unknown as Record<string, unknown>,
        );

        this.loggingService.log(
          `Updated LED ${componentId} on device ${deviceUuid} (pin: ${config.pin})`,
          context,
        );
      } else {
        throw new Error(
          peripheralFeedback?.message ||
            'Configuration update failed on Arduino',
        );
      }
    } else {
      throw new Error(
        feedback.message || 'Configuration update failed on Arduino',
      );
    }
  }

  /**
   * Enviar comando a un LED (encola en la cola genérica)
   */
  async sendCommand<T extends LEDCommand>(
    deviceUuid: string,
    componentId: string,
    command: T,
    payload?: SendCommandPayload<PeripheralType, T>,
  ): Promise<void> {
    const context = 'LEDService.sendCommand';

    // Validar dispositivo online
    const device = await this.deviceService.getDevice(deviceUuid);
    if (!device || device.status !== 'online') {
      throw new Error(`Device ${deviceUuid} is not online`);
    }

    // Encolar comando en la cola genérica
    const queue = this.queueService.getQueue();
    await queue.add(PERIPHERAL_COMMANDS_QUEUE.JOB_TYPES.PERIPHERAL_COMMAND, {
      deviceUuid,
      componentId,
      type: PeripheralType.LED,
      command,
      payload,
    });

    this.loggingService.debug(
      `Enqueued LED command ${command} for ${componentId} on device ${deviceUuid}`,
      context,
    );
  }
}
