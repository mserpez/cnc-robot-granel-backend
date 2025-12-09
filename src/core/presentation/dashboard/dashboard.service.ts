import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../../domain/device/device.service';
import { ServerService } from '../../domain/server/server.service';
import { LoggingService } from '../../infrastructure/logging/logging.service';
import type { DashboardStatus } from './dashboard.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly configService: ConfigService,
    private readonly deviceService: DeviceService,
    private readonly serverService: ServerService,
  ) {}

  async getDashboardStatus(): Promise<DashboardStatus> {
    const context = 'DashboardService.getDashboardStatus';
    this.loggingService.debug('Getting dashboard status', context);

    const serviceHealth = await this.serverService.getServiceHealthStatus();

    const status: DashboardStatus = {
      server: {
        online: true,
        version: this.configService.get<string>('APP_VERSION') ?? '0.0.1',
      },
      database: {
        connected: serviceHealth.database.connected,
        error: serviceHealth.database.error,
        name: serviceHealth.database.info.name,
        host: serviceHealth.database.info.host,
        port: serviceHealth.database.info.port,
      },
      redis: {
        connected: serviceHealth.redis.connected,
        error: serviceHealth.redis.error,
        host: serviceHealth.redis.info.host,
        port: serviceHealth.redis.info.port,
      },
      mqtt: {
        connected: serviceHealth.mqtt.connected,
        error: serviceHealth.mqtt.error,
        host: serviceHealth.mqtt.info.host,
        port: serviceHealth.mqtt.info.port,
        useTls: serviceHealth.mqtt.info.useTls,
      },
      devices: {
        connected: (await this.deviceService.getOnlineDevices()).length,
        total: (await this.deviceService.getDevices()).length,
        list: (await this.deviceService.getDevices()).map((device) => ({
          uuid: device.uuid,
          status: device.status,
          lastSeen: device.lastSeen,
          ip: device.ip ?? undefined,
        })),
      },
    };

    this.loggingService.debug(
      `Dashboard status: ${JSON.stringify(status)}`,
      context,
    );

    return status;
  }
}
