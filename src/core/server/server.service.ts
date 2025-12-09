import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { MqttService } from '../mqtt/mqtt.service';
import { QueueService } from '../queue/queue.service';
import type {
  DatabaseInfo,
  MqttInfo,
  RedisInfo,
  ServiceHealthStatus,
} from './server.types';

@Injectable()
export class ServerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly mqttService: MqttService,
    private readonly loggingService: LoggingService,
    private readonly configService: ConfigService,
  ) {}

  async getServiceHealthStatus(): Promise<ServiceHealthStatus> {
    const context = 'ServerService.getServiceHealthStatus';
    this.loggingService.debug('Getting service health status', context);

    const [dbStatus, redisStatus, mqttStatus] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      Promise.resolve(this.checkMqtt()),
    ]);

    const dbInfo = this.getDatabaseInfo();
    const redisInfo = this.getRedisInfo();
    const mqttInfo = this.getMqttInfo();

    return {
      database: {
        connected: dbStatus.status === 'fulfilled' && dbStatus.value,
        error:
          dbStatus.status === 'rejected'
            ? (dbStatus.reason?.message ?? 'Unknown error')
            : null,
        info: dbInfo,
      },
      redis: {
        connected: redisStatus.status === 'fulfilled' && redisStatus.value,
        error:
          redisStatus.status === 'rejected'
            ? (redisStatus.reason?.message ?? 'Unknown error')
            : null,
        info: redisInfo,
      },
      mqtt: {
        connected: mqttStatus.status === 'fulfilled' && mqttStatus.value,
        error:
          mqttStatus.status === 'rejected'
            ? (mqttStatus.reason?.message ?? 'Unknown error')
            : null,
        info: mqttInfo,
      },
    };
  }

  async checkDatabase(): Promise<boolean> {
    const context = 'ServerService.checkDatabase';
    try {
      // Intentar hacer una query simple para verificar conexión con timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database check timeout')), 2000);
      });

      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeoutPromise]);

      return true;
    } catch (error) {
      // Solo loggear el error si no es un timeout o conexión rechazada
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : String(error);
      const isConnectionError =
        errorMessage.includes("Can't reach database") ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('timeout') ||
        (errorStack && errorStack.includes("Can't reach database"));

      if (!isConnectionError) {
        this.loggingService.error(
          'Database connection check failed',
          errorStack || String(error),
          context,
        );
      }
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    const context = 'ServerService.checkRedis';
    try {
      // Crear una queue temporal para verificar conexión
      // Si la queue se crea sin errores, Redis está accesible
      const testQueue = this.queueService.getQueue('dashboard-health-check');

      // Intentar obtener el conteo de jobs con timeout
      // Si funciona, Redis está conectado
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis check timeout')), 2000);
      });

      await Promise.race([testQueue.getJobCounts(), timeoutPromise]);

      return true;
    } catch (error) {
      // Solo loggear el error si no es un timeout, ECONNREFUSED o Connection is closed
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isConnectionRefused =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connect ECONNREFUSED');
      const isTimeout = errorMessage.includes('timeout');
      const isConnectionClosed = errorMessage.includes('Connection is closed');

      if (!isConnectionRefused && !isTimeout && !isConnectionClosed) {
        this.loggingService.error(
          'Redis connection check failed',
          error instanceof Error ? error.stack : String(error),
          context,
        );
      }
      return false;
    }
  }

  checkMqtt(): boolean {
    const context = 'ServerService.checkMqtt';
    try {
      // Verificar estado real del cliente MQTT (verifica flag + estado del cliente)
      const isConnected = this.mqttService.isMqttConnected();
      this.loggingService.debug(
        `MQTT connection check: ${isConnected}`,
        context,
      );
      return isConnected;
    } catch (error) {
      this.loggingService.error(
        'MQTT connection check failed',
        error instanceof Error ? error.stack : String(error),
        context,
      );
      return false;
    }
  }

  getDatabaseInfo(): DatabaseInfo {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      return {};
    }

    try {
      // Parsear DATABASE_URL: postgresql://user:password@host:port/database
      const url = new URL(dbUrl);
      return {
        name: url.pathname.slice(1), // Remover el '/' inicial
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : undefined,
      };
    } catch {
      return {};
    }
  }

  getRedisInfo(): RedisInfo {
    const redisHost =
      this.configService.get<string>('REDIS_HOST') ?? 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') ?? 6379;

    return {
      host: redisHost,
      port: redisPort,
    };
  }

  getMqttInfo(): MqttInfo {
    const brokerHost =
      this.configService.get<string>('MQTT_BROKER_HOST') ?? 'localhost';
    const brokerPort =
      this.configService.get<number>('MQTT_BROKER_PORT') ?? 1883;
    const useTls =
      this.configService.get<string>('MQTT_BROKER_USE_TLS') === 'true' ||
      brokerPort === 8883;

    return {
      host: brokerHost,
      port: brokerPort,
      useTls,
    };
  }
}

