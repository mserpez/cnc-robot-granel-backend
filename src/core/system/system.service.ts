import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../logging/logging.service';
import type { SystemHealthStatus } from './system.types';

@Injectable()
export class SystemService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly configService: ConfigService,
  ) {}

  getHealthStatus(): SystemHealthStatus {
    const context = 'SystemService.getHealthStatus';
    this.loggingService.debug(
      'Entering getHealthStatus with no parameters',
      context,
    );

    try {
      const systemVersion =
        this.configService.get<string>('APP_VERSION') ?? '0.0.1';

      const response: SystemHealthStatus = {
        system_online: true,
        system_db_connection_check: true,
        system_version: systemVersion,
      };

      this.loggingService.debug(
        `getHealthStatus returning ${JSON.stringify(response)}`,
        context,
      );

      return response;
    } catch (error) {
      this.loggingService.error(
        'Error executing getHealthStatus',
        (error as Error).stack,
        context,
      );
      throw error;
    }
  }
}
