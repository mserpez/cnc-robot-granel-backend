import { Injectable, OnModuleInit } from '@nestjs/common';
import { PeripheralType } from '@prisma/client';
import { DeviceService } from '../domain/device/device.service';
import { LoggingService } from '../infrastructure/logging/logging.service';
import { MqttService } from '../infrastructure/mqtt/mqtt.service';
import type { ConfigFeedbackMessage } from '../infrastructure/mqtt/mqtt.types';
import { PeripheralCoordinatorRepository } from './peripheral-coordinator.repository';
import type { PeripheralInfo } from './peripheral-coordinator.types';

@Injectable()
export class PeripheralCoordinatorService implements OnModuleInit {
  constructor(
    private readonly repository: PeripheralCoordinatorRepository,
    private readonly deviceService: DeviceService,
    private readonly mqttService: MqttService,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    // Registrar callback para config feedback
    this.mqttService.setOnConfigFeedbackCallback(
      async (message, deviceUuid) => {
        await this.handleConfigFeedback(message, deviceUuid);
      },
    );
  }

  /**
   * Crear un nuevo periférico y sincronizarlo con el dispositivo
   */
  async createPeripheral(
    deviceUuid: string,
    componentId: string,
    type: PeripheralType,
    config: Record<string, unknown>,
  ): Promise<PeripheralInfo> {
    const context = 'PeripheralCoordinatorService.createPeripheral';

    // Validar dispositivo existe
    const device = await this.deviceService.getDevice(deviceUuid);
    if (!device) {
      this.loggingService.error(
        `Device ${deviceUuid} not found`,
        undefined,
        context,
      );
      throw new Error(`Device ${deviceUuid} not found`);
    }

    // Verificar si ya existe
    const existing = await this.repository.findByDeviceAndComponent(
      deviceUuid,
      componentId,
    );
    if (existing) {
      this.loggingService.error(
        `Peripheral with componentId ${componentId} already exists for device ${deviceUuid}`,
        undefined,
        context,
      );
      throw new Error(
        `Peripheral with componentId ${componentId} already exists for device ${deviceUuid}`,
      );
    }

    // Crear periférico
    const peripheral = await this.repository.create({
      deviceUuid,
      componentId,
      type,
      config: config as any, // Prisma JsonValue acepta Record<string, unknown>
      state: null,
      configStatus: null, // Pending until Arduino confirms
      configError: null,
    });

    this.loggingService.log(
      `Created peripheral ${componentId} (type: ${type}) for device ${deviceUuid}`,
      context,
    );

    return peripheral;
  }

  /**
   * Actualizar configuración de un periférico y sincronizarlo
   */
  async updatePeripheral(
    deviceUuid: string,
    componentId: string,
    config: Record<string, unknown>,
  ): Promise<PeripheralInfo> {
    const context = 'PeripheralCoordinatorService.updatePeripheral';

    // Buscar periférico
    const peripheral = await this.repository.findByDeviceAndComponent(
      deviceUuid,
      componentId,
    );
    if (!peripheral) {
      this.loggingService.error(
        `Peripheral with componentId ${componentId} not found for device ${deviceUuid}`,
        undefined,
        context,
      );
      throw new Error(
        `Peripheral with componentId ${componentId} not found for device ${deviceUuid}`,
      );
    }

    // Actualizar
    const updated = await this.repository.update(peripheral.id, {
      config: config as any, // Prisma JsonValue acepta Record<string, unknown>
    });

    this.loggingService.log(
      `Updated peripheral ${componentId} for device ${deviceUuid}`,
      context,
    );

    return updated;
  }

  /**
   * Obtener todos los periféricos de un dispositivo
   */
  async getPeripheralsByDevice(deviceUuid: string): Promise<PeripheralInfo[]> {
    return this.repository.findByDevice(deviceUuid);
  }

  /**
   * Actualizar estado de configuración de un periférico
   */
  async updatePeripheralConfigStatus(
    deviceUuid: string,
    componentId: string,
    status: string | null,
    errorMessage?: string | null,
  ): Promise<PeripheralInfo> {
    const context = 'PeripheralCoordinatorService.updatePeripheralConfigStatus';

    const updated = await this.repository.updateConfigStatus(
      deviceUuid,
      componentId,
      status,
      errorMessage,
    );

    this.loggingService.log(
      `Updated config status for peripheral ${componentId} on device ${deviceUuid}: ${status}`,
      context,
    );

    return updated;
  }

  /**
   * Eliminar un periférico
   */
  async deletePeripheral(
    deviceUuid: string,
    componentId: string,
  ): Promise<void> {
    const context = 'PeripheralCoordinatorService.deletePeripheral';

    // 1. Verificar que existe
    const peripheral = await this.repository.findByDeviceAndComponent(
      deviceUuid,
      componentId,
    );
    if (!peripheral) {
      this.loggingService.error(
        `Peripheral ${componentId} not found for device ${deviceUuid}`,
        undefined,
        context,
      );
      throw new Error(`Peripheral ${componentId} not found`);
    }

    // 2. Obtener todos los periféricos del dispositivo
    const allPeripherals = await this.repository.findByDevice(deviceUuid);

    // 3. Construir config SIN el periférico a eliminar
    const config = {
      peripherals: allPeripherals
        .filter((p) => p.componentId !== componentId)
        .map((p) => ({
          componentId: p.componentId,
          type: p.type,
          config: p.config,
        })),
    };

    // 4. Enviar config a Arduino y esperar feedback
    const feedback = await this.mqttService.publishConfig(deviceUuid, config);

    // 5. Si feedback es success, eliminar de DB
    if (feedback.status === 'success') {
      await this.repository.delete(peripheral.id);
      this.loggingService.log(
        `Deleted peripheral ${componentId} from device ${deviceUuid}`,
        context,
      );
    } else {
      this.loggingService.error(
        `Failed to delete peripheral ${componentId} on Arduino: ${feedback.message}`,
        undefined,
        context,
      );
      throw new Error(
        feedback.message || 'Failed to delete peripheral on Arduino',
      );
    }
  }

  /**
   * Maneja feedback de configuración desde MQTT
   */
  private async handleConfigFeedback(
    message: ConfigFeedbackMessage,
    deviceUuid: string,
  ): Promise<void> {
    const context = 'PeripheralCoordinatorService.handleConfigFeedback';

    try {
      // Procesar feedback de configuración
      if (message.status === 'success') {
        // Si hay array de periféricos, actualizar cada uno
        if (message.peripherals && message.peripherals.length > 0) {
          for (const peripheral of message.peripherals) {
            if (peripheral.status === 'success') {
              await this.updatePeripheralConfigStatus(
                deviceUuid,
                peripheral.componentId,
                'applied',
                null,
              );
            } else {
              await this.updatePeripheralConfigStatus(
                deviceUuid,
                peripheral.componentId,
                'error',
                peripheral.message || 'Configuration failed',
              );
            }
          }
        } else {
          this.loggingService.debug(
            'Config feedback success but no peripherals array - cannot update individual statuses',
            context,
          );
        }
      } else {
        // Error general
        if (message.peripherals && message.peripherals.length > 0) {
          for (const peripheral of message.peripherals) {
            if (peripheral.status === 'error') {
              await this.updatePeripheralConfigStatus(
                deviceUuid,
                peripheral.componentId,
                'error',
                peripheral.message || message.message || 'Configuration failed',
              );
            } else {
              // Si el feedback general es error, pero un periférico es success, lo marcamos como aplicado
              await this.updatePeripheralConfigStatus(
                deviceUuid,
                peripheral.componentId,
                'applied',
                null,
              );
            }
          }
        } else {
          // Si es un error general sin detalles por periférico, marcar todos los periféricos del dispositivo como error
          const peripherals = await this.getPeripheralsByDevice(deviceUuid);
          for (const peripheral of peripherals) {
            await this.updatePeripheralConfigStatus(
              deviceUuid,
              peripheral.componentId,
              'error',
              message.message || 'General configuration error',
            );
          }
        }
      }
    } catch (error) {
      this.loggingService.error(
        `Error in handleConfigFeedback for device ${deviceUuid}`,
        (error as Error).stack,
        context,
      );
    }
  }
}
