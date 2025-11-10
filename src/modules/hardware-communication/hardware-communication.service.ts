import { Injectable } from '@nestjs/common';
import { LoggingService } from '../../core';

@Injectable()
export class HardwareCommunicationService {
  constructor(private readonly loggingService: LoggingService) {
    this.loggingService.debug(
      'Hardware communication service instantiated',
      'HardwareCommunicationService',
    );
  }
}
