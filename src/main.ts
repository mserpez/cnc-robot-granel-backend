import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BullBoardService, LoggingService } from './core';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const loggingService = app.get<LoggingService>(LoggingService);
  loggingService.debug('Starting application bootstrap', 'Bootstrap');

  app.useLogger(loggingService);

  // Configurar helmet con CSP que permita scripts inline para el dashboard
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Permitir scripts inline para el dashboard
          styleSrc: ["'self'", "'unsafe-inline'"], // Permitir estilos inline
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  app.enableShutdownHooks();

  const bullBoardService = app.get<BullBoardService>(BullBoardService);
  bullBoardService.mount(app);

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
