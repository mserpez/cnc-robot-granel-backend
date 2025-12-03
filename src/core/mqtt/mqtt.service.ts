import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { LoggingService } from '../logging/logging.service';
import type { DiscoveryRequest, DiscoveryResponse } from './mqtt.types';
import * as os from 'os';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;
  private readonly brokerHost: string;
  private readonly brokerPort: number;
  private readonly brokerUsername?: string;
  private readonly brokerPassword?: string;
  private readonly useTls: boolean;
  private readonly serverPort: number;
  private readonly discoveryTopicPattern = 'cnc-granel/discovery/+';
  private isConnected = false;
  private connectionErrorCount = 0;
  private lastErrorLogTime = 0;
  private readonly ERROR_LOG_INTERVAL_MS = 30000; // Log error cada 30 segundos máximo

  constructor(
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {
    this.brokerHost =
      this.configService.get<string>('MQTT_BROKER_HOST') ?? 'localhost';
    this.brokerPort =
      this.configService.get<number>('MQTT_BROKER_PORT') ?? 1883;
    this.brokerUsername =
      this.configService.get<string>('MQTT_BROKER_USERNAME');
    this.brokerPassword =
      this.configService.get<string>('MQTT_BROKER_PASSWORD');
    // TLS si el puerto es 8883 (estándar SSL) o si está explícitamente configurado
    this.useTls =
      this.configService.get<string>('MQTT_BROKER_USE_TLS') === 'true' ||
      this.brokerPort === 8883;
    this.serverPort =
      this.configService.get<number>('SERVER_PORT') ??
      this.configService.get<number>('PORT') ??
      3000;
  }

  onModuleInit(): void {
    this.connect();
  }

  onModuleDestroy(): void {
    this.disconnect();
  }

  private disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      this.connectionErrorCount = 0;
      this.loggingService.log('Backend disconnected from MQTT broker', 'MqttService');
    }
  }

  private connect(): void {
    const context = 'MqttService.connect';
    const protocol = this.useTls ? 'mqtts' : 'mqtt';
    const brokerUrl = `${protocol}://${this.brokerHost}:${this.brokerPort}`;

    this.loggingService.debug(
      `Connecting backend to MQTT broker at ${brokerUrl}`,
      context,
    );

    const connectOptions: mqtt.IClientOptions = {
      clientId: `cnc-granel-backend-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };

    // Agregar autenticación si está configurada
    if (this.brokerUsername) {
      connectOptions.username = this.brokerUsername;
    }
    if (this.brokerPassword) {
      connectOptions.password = this.brokerPassword;
    }

    // Configurar TLS si es necesario
    if (this.useTls) {
      connectOptions.rejectUnauthorized = false; // Para desarrollo, aceptar certificados autofirmados
      // En producción, deberías configurar correctamente los certificados
    }

    this.client = mqtt.connect(brokerUrl, connectOptions);

    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionErrorCount = 0;
      this.loggingService.log(
        `Backend connected to MQTT broker at ${brokerUrl}`,
        context,
      );
      this.subscribeToDiscovery();
    });

    this.client.on('error', (error) => {
      this.connectionErrorCount++;
      const now = Date.now();
      const timeSinceLastLog = now - this.lastErrorLogTime;

      // Solo loggear errores si:
      // 1. Es el primer error, o
      // 2. Han pasado más de ERROR_LOG_INTERVAL_MS desde el último log
      if (this.connectionErrorCount === 1 || timeSinceLastLog >= this.ERROR_LOG_INTERVAL_MS) {
        const errorMessage = error.message || String(error);
        const errorStack = error.stack || String(error);
        const errorString = String(error);
        
        // Detectar ECONNREFUSED en mensaje, stack o string completo
        // AggregateError puede tener ECONNREFUSED en sus errores internos
        const isConnectionRefused = 
          errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('connect ECONNREFUSED') ||
          errorStack.includes('ECONNREFUSED') ||
          errorString.includes('ECONNREFUSED');

        if (isConnectionRefused && this.connectionErrorCount > 1) {
          // Para ECONNREFUSED después del primer error, usar warn en lugar de error
          this.loggingService.warn(
            `MQTT broker not available at ${brokerUrl} (attempt ${this.connectionErrorCount}). Will keep retrying...`,
            context,
          );
        } else {
          this.loggingService.error(
            `Backend failed to connect to MQTT broker: ${errorMessage}`,
            errorStack,
            context,
          );
        }
        this.lastErrorLogTime = now;
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      // Solo loggear close si estaba conectado previamente
      if (this.connectionErrorCount === 0) {
        this.loggingService.warn('Backend disconnected from MQTT broker', context);
      }
    });

    this.client.on('reconnect', () => {
      // Solo loggear reconnect en modo debug, no es crítico
      this.loggingService.debug('Backend reconnecting to MQTT broker...', context);
    });

    this.client.on('offline', () => {
      this.isConnected = false;
      // Solo loggear offline si estaba conectado previamente
      if (this.connectionErrorCount === 0) {
        this.loggingService.warn('Backend lost connection to MQTT broker', context);
      }
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  private subscribeToDiscovery(): void {
    const context = 'MqttService.subscribeToDiscovery';

    if (!this.client || !this.isConnected) {
      this.loggingService.error(
        'Cannot subscribe: MQTT client not connected',
        undefined,
        context,
      );
      return;
    }

    this.client.subscribe(this.discoveryTopicPattern, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${this.discoveryTopicPattern}`,
          err.stack,
          context,
        );
      } else {
        this.loggingService.log(
          `Subscribed to ${this.discoveryTopicPattern}`,
          context,
        );
      }
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    const context = 'MqttService.handleMessage';

    try {
      const messageStr = message.toString('utf8');
      this.loggingService.debug(
        `Received MQTT message on topic ${topic}: ${messageStr}`,
        context,
      );

      // Verificar si es un topic de discovery
      if (topic.startsWith('cnc-granel/discovery/')) {
        const uuid = topic.replace('cnc-granel/discovery/', '');
        if (uuid && !uuid.includes('/')) {
          // Es un discovery request, no una respuesta
          this.handleDiscoveryRequest(uuid, messageStr);
        }
      }
    } catch (error) {
      this.loggingService.error(
        `Error handling MQTT message on topic ${topic}`,
        (error as Error).stack,
        context,
      );
    }
  }

  private handleDiscoveryRequest(uuid: string, messageStr: string): void {
    const context = 'MqttService.handleDiscoveryRequest';

    try {
      const request: DiscoveryRequest = JSON.parse(messageStr);

      this.loggingService.debug(
        `Discovery request from device ${uuid}: ${JSON.stringify(request)}`,
        context,
      );

      // Responder con información del servidor
      const response: DiscoveryResponse = {
        server_ip: this.getLocalIPAddress(),
        server_port: this.serverPort,
        status: 'ready',
      };

      this.sendDiscoveryResponse(uuid, response);
    } catch (error) {
      this.loggingService.error(
        `Error processing discovery request from ${uuid}`,
        (error as Error).stack,
        context,
      );
    }
  }

  private sendDiscoveryResponse(
    uuid: string,
    response: DiscoveryResponse,
  ): void {
    const context = 'MqttService.sendDiscoveryResponse';
    const responseTopic = `cnc-granel/discovery/${uuid}/response`;

    if (!this.client || !this.isConnected) {
      this.loggingService.error(
        'Cannot send discovery response: MQTT client not connected',
        undefined,
        context,
      );
      return;
    }

    const responseJson = JSON.stringify(response);

    this.client.publish(responseTopic, responseJson, { qos: 1 }, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to publish discovery response to ${responseTopic}`,
          err.stack,
          context,
        );
      } else {
        this.loggingService.debug(
          `Sent discovery response to ${responseTopic}: ${responseJson}`,
          context,
        );
      }
    });
  }

  private getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();

    // Priorizar interfaces IPv4 que no sean loopback
    for (const interfaceName in interfaces) {
      const addresses = interfaces[interfaceName];
      if (!addresses) {
        continue;
      }

      for (const address of addresses) {
        // Preferir IPv4, no loopback, no internal
        if (
          address.family === 'IPv4' &&
          !address.internal &&
          address.address
        ) {
          return address.address;
        }
      }
    }

    // Si no encontramos una IP externa, usar la primera IPv4 disponible
    for (const interfaceName in interfaces) {
      const addresses = interfaces[interfaceName];
      if (!addresses) {
        continue;
      }

      for (const address of addresses) {
        if (address.family === 'IPv4' && address.address) {
          return address.address;
        }
      }
    }

    // Fallback a localhost
    return '127.0.0.1';
  }

  public isMqttConnected(): boolean {
    return this.isConnected;
  }

  public publish(topic: string, message: string, options?: mqtt.IClientPublishOptions): void {
    if (!this.client || !this.isConnected) {
      this.loggingService.warn(
        `Cannot publish to ${topic}: MQTT client not connected`,
        'MqttService.publish',
      );
      return;
    }

    this.client.publish(topic, message, options || {}, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to publish to ${topic}`,
          err.stack,
          'MqttService.publish',
        );
      }
    });
  }
}

