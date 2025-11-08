import { Controller, Get } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { SystemService } from './system.service';
import type { SystemHealthStatus } from './system.types';

@Controller('system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('health')
  getHealth(): SystemHealthStatus {
    const context = 'SystemController.getHealth';
    this.loggingService.debug('Handling GET /system/health', context);

    try {
      const response = this.systemService.getHealthStatus();

      this.loggingService.debug(
        `getHealth returning ${JSON.stringify(response)}`,
        context,
      );

      return response;
    } catch (error) {
      this.loggingService.error(
        'Error executing getHealth',
        (error as Error).stack,
        context,
      );
      throw error;
    }
  }
}
