import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DeviceService } from '../../domain/device/device.service';
import { LoggingService } from '../../infrastructure/logging/logging.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { DashboardService } from './dashboard.service';
import type { DashboardStatus } from './dashboard.types';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly deviceService: DeviceService,
    private readonly mqttService: MqttService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get()
  async getDashboardStatus(): Promise<DashboardStatus> {
    const context = 'DashboardController.getDashboardStatus';
    this.loggingService.debug('Handling GET /dashboard', context);

    try {
      return await this.dashboardService.getDashboardStatus();
    } catch (error) {
      this.loggingService.error(
        'Error getting dashboard status',
        error instanceof Error ? error.stack : String(error),
        context,
      );
      throw error;
    }
  }

  @Post('devices/:uuid/ping')
  async pingDevice(
    @Param('uuid') uuid: string,
    @Res() res: Response,
  ): Promise<void> {
    const context = 'DashboardController.pingDevice';

    try {
      // Validar que el dispositivo existe
      const device = await this.deviceService.getDevice(uuid);
      if (!device) {
        res.status(404).json({
          success: false,
          error: 'Device not found',
        });
        return;
      }

      // Enviar ping y esperar respuesta
      const rtt = await this.mqttService.pingDevice(uuid, 3000);

      res.json({
        success: true,
        rtt,
      });
    } catch (error) {
      this.loggingService.error(
        `Error pinging device ${uuid}`,
        error instanceof Error ? error.stack : String(error),
        context,
      );

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}
