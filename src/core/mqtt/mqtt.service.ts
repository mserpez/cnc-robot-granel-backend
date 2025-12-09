import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import * as os from 'os';
import { MQTT_TOPICS, SERVER_DEVICE_ID } from '../../constants';
import { DeviceService } from '../device/device.service';
import { LoggingService } from '../logging/logging.service';
import type { DiscoveryMessage } from './mqtt.types';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;
  private readonly brokerHost: string;
  private readonly brokerPort: number;
  private readonly brokerUsername?: string;
  private readonly brokerPassword?: string;
  private readonly useTls: boolean;
  private readonly serverPort: number;
  private isConnected = false;
  private connectionErrorCount = 0;
  private lastErrorLogTime = 0;
  private readonly ERROR_LOG_INTERVAL_MS = 30000; // Log error cada 30 segundos máximo

  constructor(
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
    private readonly deviceService: DeviceService,
  ) {
    this.brokerHost =
      this.configService.get<string>('MQTT_BROKER_HOST') ?? 'localhost';
    this.brokerPort =
      this.configService.get<number>('MQTT_BROKER_PORT') ?? 1883;
    this.brokerUsername = this.configService.get<string>(
      'MQTT_BROKER_USERNAME',
    );
    this.brokerPassword = this.configService.get<string>(
      'MQTT_BROKER_PASSWORD',
    );
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
      this.loggingService.log(
        'Backend disconnected from MQTT broker',
        'MqttService',
      );
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
      reconnectPeriod: 5000, // Intentar reconectar cada 5 segundos
      connectTimeout: 10000,
      keepalive: 60, // Mantener conexión viva
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
      // Resubscribirse después de reconexión
      this.subscribeToDiscovery();
      // Enviar broadcast para que dispositivos se reconecten
      this.broadcastServerOnline();
    });

    this.client.on('error', (error) => {
      this.connectionErrorCount++;
      const now = Date.now();
      const timeSinceLastLog = now - this.lastErrorLogTime;

      // Solo loggear errores si:
      // 1. Es el primer error, o
      // 2. Han pasado más de ERROR_LOG_INTERVAL_MS desde el último log
      if (
        this.connectionErrorCount === 1 ||
        timeSinceLastLog >= this.ERROR_LOG_INTERVAL_MS
      ) {
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
        this.loggingService.warn(
          'Backend disconnected from MQTT broker',
          context,
        );
      }
    });

    this.client.on('reconnect', () => {
      // Cuando se reconecta, el flag se actualizará en el evento 'connect'
      this.loggingService.debug(
        'Backend reconnecting to MQTT broker...',
        context,
      );
    });

    this.client.on('offline', () => {
      this.isConnected = false;
      // Solo loggear offline si estaba conectado previamente
      if (this.connectionErrorCount === 0) {
        this.loggingService.warn(
          'Backend lost connection to MQTT broker',
          context,
        );
      }
    });

    this.client.on('message', (topic, message) => {
      this.loggingService.log(
        `MQTT message received on topic: ${topic}`,
        'MqttService.onMessage',
      );
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

    this.client.subscribe(MQTT_TOPICS.DISCOVERY.TOPIC, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${MQTT_TOPICS.DISCOVERY.TOPIC}`,
          err.stack,
          context,
        );
      } else {
        this.loggingService.log(
          `Subscribed to ${MQTT_TOPICS.DISCOVERY.TOPIC}`,
          context,
        );
      }
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    const context = 'MqttService.handleMessage';

    try {
      const messageStr = message.toString('utf8');
      this.loggingService.log(
        `Received MQTT message on topic ${topic}: ${messageStr}`,
        context,
      );

      // Procesar discovery messages
      // Topic único: 'cnc-granel/discovery' (deviceId viene en payload)
      if (topic === MQTT_TOPICS.DISCOVERY.TOPIC) {
        const payload: DiscoveryMessage = JSON.parse(messageStr);
        this.handleDiscovery(payload);
      }
    } catch (error) {
      this.loggingService.error(
        `Error handling MQTT message on topic ${topic}`,
        (error as Error).stack,
        context,
      );
    }
  }

  private handleDiscovery(message: DiscoveryMessage): void {
    const context = 'MqttService.handleDiscovery';

    // Ejecutar async sin bloquear
    this.handleDiscoveryAsync(message).catch((error) => {
      this.loggingService.error(
        `Error processing discovery message from ${message.deviceId}`,
        (error as Error).stack,
        context,
      );
    });
  }

  private async handleDiscoveryAsync(message: DiscoveryMessage): Promise<void> {
    const context = 'MqttService.handleDiscoveryAsync';

    try {
      this.loggingService.log(
        `Discovery message from device ${message.deviceId}: ${JSON.stringify(message)}`,
        context,
      );

      // Ignorar si es el servidor
      if (message.deviceId === SERVER_DEVICE_ID) {
        this.loggingService.debug(
          'Ignoring discovery message from server',
          context,
        );
        return;
      }

      // Registrar dispositivo en el service
      if (!this.deviceService) {
        this.loggingService.error(
          'DeviceService is not available',
          undefined,
          context,
        );
        return;
      }

      this.loggingService.log(
        `Registering device ${message.deviceId} with IP ${message.ip || 'N/A'}, Board: ${message.boardName || 'N/A'}, Firmware: ${message.firmwareVersion || 'N/A'}`,
        context,
      );
      await this.deviceService.registerDevice(
        message.deviceId,
        message.ip,
        message.boardName,
        message.firmwareVersion,
      );
      // No hay response - comunicación solo por MQTT
    } catch (error) {
      this.loggingService.error(
        `Error processing discovery message from ${message.deviceId}`,
        (error as Error).stack,
        context,
      );
    }
  }

  private broadcastServerOnline(): void {
    const context = 'MqttService.broadcastServerOnline';

    if (!this.client || !this.isConnected) {
      this.loggingService.error(
        'Cannot broadcast server online: MQTT client not connected',
        undefined,
        context,
      );
      return;
    }

    const message = JSON.stringify({
      server_ip: this.getLocalIPAddress(),
      server_port: this.serverPort,
      status: 'online',
      timestamp: new Date().toISOString(),
    });

    this.client.publish(
      MQTT_TOPICS.SERVER.ONLINE,
      message,
      { qos: 1 },
      (err) => {
        if (err) {
          this.loggingService.error(
            `Failed to broadcast server online to ${MQTT_TOPICS.SERVER.ONLINE}`,
            err.stack,
            context,
          );
        } else {
          this.loggingService.log(
            `Broadcasted server online to ${MQTT_TOPICS.SERVER.ONLINE}`,
            context,
          );
        }
      },
    );
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
        if (address.family === 'IPv4' && !address.internal && address.address) {
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
    // Verificar el estado real del cliente (más confiable que el flag)
    if (!this.client) {
      return false;
    }

    // El cliente MQTT tiene una propiedad connected que es la fuente de verdad
    // Verificar si existe la propiedad connected
    let actuallyConnected = false;
    if (typeof (this.client as any).connected === 'boolean') {
      actuallyConnected = (this.client as any).connected;
    } else {
      // Fallback: verificar si el cliente está en estado de conexión
      // El cliente puede estar conectado aunque la propiedad no esté disponible
      actuallyConnected = this.isConnected;
    }

    // Sincronizar el flag interno con el estado real del cliente
    if (this.isConnected !== actuallyConnected) {
      this.isConnected = actuallyConnected;
    }

    return actuallyConnected;
  }

  public publish(
    topic: string,
    message: string,
    options?: mqtt.IClientPublishOptions,
  ): void {
    // Verificar el estado real de conexión
    const isConnected = this.isMqttConnected();
    if (!this.client || !isConnected) {
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
