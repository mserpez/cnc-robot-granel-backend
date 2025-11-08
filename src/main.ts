/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingService } from './core/logging/logging.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const loggingService = app.get<LoggingService>(LoggingService);
  loggingService.debug('Starting application bootstrap', 'Bootstrap');

  app.useLogger(loggingService);
  app.use(helmet());
  app.enableShutdownHooks();

  const configService = app.get<ConfigService>(ConfigService);
  const portValue = configService.get<string>('PORT');
  const parsedPort = portValue ? parseInt(portValue, 10) : 3000;
  const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

  await app.listen(port);
  loggingService.log(
    `Application running on http://localhost:${port}`,
    'Bootstrap',
  );
}

void bootstrap();
