import { Injectable, OnModuleInit } from '@nestjs/common';
import { PeripheralType } from '@prisma/client';
import { PERIPHERAL_COMMANDS_QUEUE } from '../../constants';
import { LoggingService, QueueService } from '../../core';
import { MqttService } from '../infrastructure/mqtt/mqtt.service';
import type { PeripheralCommandJobPayload } from './peripheral-coordinator.types';

@Injectable()
export class PeripheralCommandWorker implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly mqttService: MqttService,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    this.queueService.createWorker<PeripheralCommandJobPayload>(
      PERIPHERAL_COMMANDS_QUEUE.NAME,
      async (job) => {
        const context = 'PeripheralCommandWorker';
        const { deviceUuid, componentId, type, command, payload } = job.data;

        this.loggingService.log(
          `Processing peripheral command: ${type}.${command} for ${componentId} on device ${deviceUuid}`,
          context,
        );

        try {
          // Enrutar a handler específico según tipo
          if (type === PeripheralType.LED) {
            await this.handleLEDCommand(
              deviceUuid,
              componentId,
              command,
              payload,
            );
          } else {
            throw new Error(`Unknown peripheral type: ${String(type)}`);
          }

          this.loggingService.log(
            `Successfully processed peripheral command: ${type}.${command} for ${componentId}`,
            context,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;

          this.loggingService.error(
            `Failed to process peripheral command: ${type}.${command} for ${componentId}`,
            errorStack,
            context,
          );

          throw new Error(`Peripheral command failed: ${errorMessage}`);
        }
      },
    );
  }

  /**
   * Handler para comandos LED
   */
  private async handleLEDCommand(
    deviceUuid: string,
    componentId: string,
    command: string,
    payload?: unknown,
  ): Promise<void> {
    const context = 'PeripheralCommandWorker.handleLEDCommand';

    // Validar comando
    if (command !== 'on' && command !== 'off') {
      throw new Error(`Invalid LED command: ${command}`);
    }

    // Publicar comando vía MQTT y esperar feedback
    // El MqttService.publishCommand retorna una Promise que se resuelve cuando llega el feedback
    await this.mqttService.publishCommand(
      deviceUuid,
      componentId,
      command,
      payload as Record<string, unknown> | undefined,
    );

    this.loggingService.debug(
      `LED command ${command} executed successfully for ${componentId}`,
      context,
    );
  }
}
