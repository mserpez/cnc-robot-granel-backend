import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LOGGING_SERVICE_TOKEN } from './logging.constants';
import { LoggingService } from './logging.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LoggingService,
    {
      provide: LOGGING_SERVICE_TOKEN,
      useExisting: LoggingService,
    },
  ],
  exports: [LoggingService, LOGGING_SERVICE_TOKEN],
})
export class LoggingModule {}
