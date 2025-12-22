import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as mqtt from 'mqtt';
import * as os from 'os';
import { MQTT_TOPICS } from '../../../constants';
import { DeviceService } from '../../domain/device/device.service';
import { LoggingService } from '../logging/logging.service';
import type {
  CommandFeedbackMessage,
  CommandMessage,
  ConfigFeedbackMessage,
  DisconnectionMessage,
  DiscoveryMessage,
  PongMessage,
} from './mqtt.types';

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

  // Ping/Pong tracking
  private readonly pendingPings = new Map<
    string,
    {
      resolve: (rtt: number) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private readonly subscribedPongDevices = new Set<string>(); // UUIDs de dispositivos suscritos a pong

  // Command feedback tracking
  private readonly pendingCommands = new Map<
    string,
    {
      resolve: (feedback: CommandFeedbackMessage) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private readonly subscribedCommandFeedbackDevices = new Set<string>(); // UUIDs de dispositivos suscritos a feedback
  private readonly subscribedConfigFeedbackDevices = new Set<string>(); // UUIDs de dispositivos suscritos a config feedback

  // Config feedback tracking
  private readonly pendingConfigs = new Map<
    string, // deviceUuid
    {
      resolve: (feedback: ConfigFeedbackMessage) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  // Callback para config feedback (registrado por PeripheralCoordinatorService)
  private onConfigFeedbackCallback?: (
    message: ConfigFeedbackMessage,
    deviceUuid: string,
  ) => Promise<void> | void;

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
      this.subscribeToDisconnections();
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

  private subscribeToDisconnections(): void {
    const context = 'MqttService.subscribeToDisconnections';

    if (!this.client || !this.isConnected) {
      this.loggingService.error(
        'Cannot subscribe: MQTT client not connected',
        undefined,
        context,
      );
      return;
    }

    this.client.subscribe(MQTT_TOPICS.DISCONNECTED.TOPIC, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${MQTT_TOPICS.DISCONNECTED.TOPIC}`,
          err.stack,
          context,
        );
      } else {
        this.loggingService.log(
          `Subscribed to ${MQTT_TOPICS.DISCONNECTED.TOPIC}`,
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
      // Procesar disconnection messages (LWT)
      // Topic único: 'cnc-granel/disconnected' (deviceId viene en payload)
      else if (topic === MQTT_TOPICS.DISCONNECTED.TOPIC) {
        const payload: DisconnectionMessage = JSON.parse(messageStr);
        this.handleDisconnection(payload);
      }
      // Procesar config feedback messages (ANTES del bloque genérico de device)
      // Topic: 'cnc-granel/{uuid}/config/feedback'
      else if (topic.endsWith('/config/feedback')) {
        const patternRegex = new RegExp(`^cnc-granel/([^/]+)/config/feedback$`);
        const match = topic.match(patternRegex);
        if (match) {
          const uuid = match[1];
          this.loggingService.log(
            `Extracted UUID from config feedback topic: ${uuid}`,
            'MqttService.handleMessage',
          );
          try {
            const payload: ConfigFeedbackMessage = JSON.parse(messageStr);
            this.loggingService.log(
              `Parsed config feedback payload for ${uuid}, pending configs: ${Array.from(this.pendingConfigs.keys()).join(', ')}`,
              'MqttService.handleMessage',
            );
            this.handleConfigFeedback(payload, uuid);
          } catch (parseError) {
            this.loggingService.error(
              `Failed to parse config feedback JSON: ${(parseError as Error).message}`,
              (parseError as Error).stack,
              'MqttService.handleMessage',
            );
          }
        } else {
          this.loggingService.warn(
            `Config feedback topic did not match pattern: ${topic}`,
            'MqttService.handleMessage',
          );
        }
      }
      // Procesar command feedback messages (ANTES del bloque genérico de device)
      // Topic: 'cnc-granel/{uuid}/component/{componentId}/feedback'
      else if (topic.includes('/component/') && topic.endsWith('/feedback')) {
        const patternRegex = new RegExp(
          `^cnc-granel/([^/]+)/component/[^/]+/feedback$`,
        );
        const match = topic.match(patternRegex);
        if (match) {
          const uuid = match[1];
          const payload: CommandFeedbackMessage = JSON.parse(messageStr);
          this.handleCommandFeedback(payload, uuid);
        }
      }
      // Procesar pong messages (respuesta a ping)
      // Topic: 'cnc-granel/{uuid}/pong'
      else if (topic.startsWith(MQTT_TOPICS.DEVICE.PREFIX)) {
        const pongTopic = topic.replace(MQTT_TOPICS.DEVICE.PREFIX, '');
        const parts = pongTopic.split('/');
        if (parts.length === 2 && parts[1] === 'pong') {
          const uuid = parts[0];
          const payload: PongMessage = JSON.parse(messageStr);
          this.handlePong(payload, uuid);
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

      // Suscribirse a config feedback cuando un dispositivo se conecta
      this.subscribeToConfigFeedback(message.deviceId);
      // No hay response - comunicación solo por MQTT
    } catch (error) {
      this.loggingService.error(
        `Error processing discovery message from ${message.deviceId}`,
        (error as Error).stack,
        context,
      );
    }
  }

  private handleDisconnection(message: DisconnectionMessage): void {
    const context = 'MqttService.handleDisconnection';

    // Ejecutar async sin bloquear
    this.handleDisconnectionAsync(message).catch((error) => {
      this.loggingService.error(
        `Error processing disconnection message from ${message.deviceId}`,
        (error as Error).stack,
        context,
      );
    });
  }

  private async handleDisconnectionAsync(
    message: DisconnectionMessage,
  ): Promise<void> {
    const context = 'MqttService.handleDisconnectionAsync';

    try {
      this.loggingService.log(
        `Disconnection message from device ${message.deviceId}: ${JSON.stringify(message)}`,
        context,
      );

      // Marcar dispositivo como desconectado
      if (!this.deviceService) {
        this.loggingService.error(
          'DeviceService is not available',
          undefined,
          context,
        );
        return;
      }

      this.loggingService.log(
        `Marking device ${message.deviceId} as disconnected (reason: ${message.reason || 'unexpected'})`,
        context,
      );
      await this.deviceService.markDeviceDisconnected(message.deviceId);
    } catch (error) {
      this.loggingService.error(
        `Error processing disconnection message from ${message.deviceId}`,
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

  /**
   * Suscribe a los mensajes pong de un dispositivo
   */
  private subscribeToDevicePongs(uuid: string): void {
    const context = 'MqttService.subscribeToDevicePongs';

    // Si ya está suscrito, no hacer nada
    if (this.subscribedPongDevices.has(uuid)) {
      return;
    }

    if (!this.client || !this.isConnected) {
      this.loggingService.error(
        'Cannot subscribe: MQTT client not connected',
        undefined,
        context,
      );
      return;
    }

    const pongTopic = MQTT_TOPICS.DEVICE.pong(uuid);
    this.client.subscribe(pongTopic, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${pongTopic}`,
          err.stack,
          context,
        );
      } else {
        this.subscribedPongDevices.add(uuid);
        this.loggingService.debug(`Subscribed to ${pongTopic}`, context);
      }
    });
  }

  /**
   * Resuscribe a todos los pongs después de reconexión
   */
  private resubscribeToPongs(): void {
    const context = 'MqttService.resubscribeToPongs';
    const devices = Array.from(this.subscribedPongDevices);
    this.subscribedPongDevices.clear();

    for (const uuid of devices) {
      this.subscribeToDevicePongs(uuid);
    }

    if (devices.length > 0) {
      this.loggingService.debug(
        `Resubscribed to ${devices.length} device pong topics`,
        context,
      );
    }
  }

  /**
   * Maneja mensajes pong recibidos
   */
  private handlePong(message: PongMessage, uuid: string): void {
    const context = 'MqttService.handlePong';

    const pending = this.pendingPings.get(message.requestId);
    if (!pending) {
      this.loggingService.warn(
        `Received pong with unknown requestId: ${message.requestId}`,
        context,
      );
      return;
    }

    // Limpiar timeout
    clearTimeout(pending.timeout);
    this.pendingPings.delete(message.requestId);

    // Calcular RTT
    const now = Date.now();
    const rtt = now - message.timestamp;

    this.loggingService.debug(
      `Received pong from device ${uuid}, RTT: ${rtt}ms`,
      context,
    );

    // Guardar RTT en la base de datos (async, no bloquea)
    this.deviceService.updateLastPingRtt(uuid, rtt).catch((error) => {
      this.loggingService.error(
        `Error saving ping RTT for device ${uuid}`,
        (error as Error).stack,
        context,
      );
    });

    // Resolver la Promise
    pending.resolve(rtt);
  }

  /**
   * Envía un ping a un dispositivo y espera la respuesta
   * @param uuid UUID del dispositivo
   * @param timeoutMs Timeout en milisegundos (default: 3000)
   * @returns Promise que se resuelve con el RTT en milisegundos
   */
  public async pingDevice(
    uuid: string,
    timeoutMs: number = 3000,
  ): Promise<number> {
    const context = 'MqttService.pingDevice';

    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    // Generar requestId único
    const requestId = randomUUID();
    const timestamp = Date.now();

    // Crear Promise con timeout
    return new Promise<number>((resolve, reject) => {
      // Configurar timeout
      const timeout = setTimeout(() => {
        this.pendingPings.delete(requestId);
        reject(new Error('Timeout'));
      }, timeoutMs);

      // Guardar Promise resolver
      this.pendingPings.set(requestId, {
        resolve,
        reject,
        timeout,
      });

      // Suscribirse a pong si no está suscrito
      this.subscribeToDevicePongs(uuid);

      // Publicar ping
      const pingTopic = MQTT_TOPICS.DEVICE.ping(uuid);
      const pingMessage: { requestId: string; timestamp: number } = {
        requestId,
        timestamp,
      };

      this.client!.publish(
        pingTopic,
        JSON.stringify(pingMessage),
        { qos: 1 },
        (err) => {
          if (err) {
            clearTimeout(timeout);
            this.pendingPings.delete(requestId);
            reject(new Error(`Failed to publish ping: ${err.message}`));
          } else {
            this.loggingService.debug(
              `Published ping to device ${uuid} (requestId: ${requestId})`,
              context,
            );
          }
        },
      );
    });
  }

  /**
   * Publica un comando a un componente de un dispositivo
   * Retorna Promise que se resuelve cuando llega el feedback
   */
  public async publishCommand(
    deviceUuid: string,
    componentId: string,
    command: string,
    payload?: Record<string, unknown>,
    timeoutMs: number = 5000,
  ): Promise<CommandFeedbackMessage> {
    const context = 'MqttService.publishCommand';

    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    // Validar dispositivo online
    const device = await this.deviceService.getDevice(deviceUuid);
    if (!device || device.status !== 'online') {
      throw new Error(`Device ${deviceUuid} is not online`);
    }

    return new Promise<CommandFeedbackMessage>((resolve, reject) => {
      const requestId = randomUUID();
      const timestamp = Date.now();

      const commandMessage: CommandMessage = {
        command,
        payload,
        requestId,
        timestamp,
      };

      // Suscribirse a feedback si no está suscrito
      this.subscribeToCommandFeedback(deviceUuid);

      // Timeout
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error(`Command timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Guardar promise resolvers
      this.pendingCommands.set(requestId, { resolve, reject, timeout });

      // Publicar comando
      const commandTopic = MQTT_TOPICS.DEVICE.command(deviceUuid, componentId);
      this.client!.publish(
        commandTopic,
        JSON.stringify(commandMessage),
        { qos: 1 },
        (err) => {
          if (err) {
            clearTimeout(timeout);
            this.pendingCommands.delete(requestId);
            reject(new Error(`Failed to publish command: ${err.message}`));
          } else {
            this.loggingService.debug(
              `Published command to ${commandTopic} (requestId: ${requestId})`,
              context,
            );
          }
        },
      );
    });
  }

  /**
   * Publica configuración completa de periféricos a un dispositivo
   * Retorna Promise que se resuelve cuando llega feedback de Arduino
   */
  public async publishConfig(
    deviceUuid: string,
    config: { peripherals: Array<Record<string, unknown>> },
    timeoutMs: number = 5000,
  ): Promise<ConfigFeedbackMessage> {
    const context = 'MqttService.publishConfig';

    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    // Validar dispositivo online
    const device = await this.deviceService.getDevice(deviceUuid);
    if (!device || device.status !== 'online') {
      throw new Error(`Device ${deviceUuid} is not online`);
    }

    return new Promise<ConfigFeedbackMessage>((resolve, reject) => {
      // Verificar si ya hay una config pendiente para este dispositivo
      const existing = this.pendingConfigs.get(deviceUuid);
      if (existing) {
        clearTimeout(existing.timeout);
        existing.reject(
          new Error('New config request cancelled previous pending config'),
        );
      }

      // Suscribirse a feedback si no está suscrito
      this.subscribeToConfigFeedback(deviceUuid);

      // Timeout
      const timeout = setTimeout(() => {
        this.pendingConfigs.delete(deviceUuid);
        reject(new Error(`Config timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Guardar promise resolvers
      this.pendingConfigs.set(deviceUuid, { resolve, reject, timeout });
      this.loggingService.log(
        `Added pending config for ${deviceUuid}, total pending: ${this.pendingConfigs.size}`,
        context,
      );

      // Publicar config
      const configTopic = MQTT_TOPICS.DEVICE.config(deviceUuid);
      const message = JSON.stringify(config);

      this.client!.publish(configTopic, message, { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingConfigs.delete(deviceUuid);
          reject(new Error(`Failed to publish config: ${err.message}`));
        } else {
          this.loggingService.log(
            `Published config to ${configTopic}`,
            context,
          );
        }
      });
    });
  }

  /**
   * Suscribe a feedback topics de comandos para un dispositivo
   */
  private subscribeToCommandFeedback(uuid: string): void {
    const context = 'MqttService.subscribeToCommandFeedback';

    // Si ya está suscrito, no hacer nada
    if (this.subscribedCommandFeedbackDevices.has(uuid)) {
      return;
    }

    if (!this.client || !this.isConnected) {
      this.loggingService.warn(
        `Cannot subscribe to command feedback for ${uuid}: MQTT client not connected`,
        context,
      );
      return;
    }

    const feedbackPattern = MQTT_TOPICS.DEVICE.commandFeedbackPattern(uuid);
    this.client.subscribe(feedbackPattern, { qos: 1 }, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${feedbackPattern}`,
          err.stack,
          context,
        );
      } else {
        this.subscribedCommandFeedbackDevices.add(uuid);
        this.loggingService.log(
          `Subscribed to command feedback pattern: ${feedbackPattern}`,
          context,
        );
      }
    });
  }

  /**
   * Registrar callback para config feedback
   */
  setOnConfigFeedbackCallback(
    callback: (
      message: ConfigFeedbackMessage,
      deviceUuid: string,
    ) => Promise<void> | void,
  ): void {
    this.onConfigFeedbackCallback = callback;
  }

  /**
   * Suscribe a feedback topics de configuración para un dispositivo
   */
  private subscribeToConfigFeedback(uuid: string): void {
    const context = 'MqttService.subscribeToConfigFeedback';

    // Si ya está suscrito, no hacer nada
    if (this.subscribedConfigFeedbackDevices.has(uuid)) {
      return;
    }

    if (!this.client || !this.isConnected) {
      this.loggingService.warn(
        `Cannot subscribe to config feedback for ${uuid}: MQTT client not connected`,
        context,
      );
      return;
    }

    const feedbackTopic = MQTT_TOPICS.DEVICE.configFeedback(uuid);
    this.client.subscribe(feedbackTopic, { qos: 1 }, (err) => {
      if (err) {
        this.loggingService.error(
          `Failed to subscribe to ${feedbackTopic}`,
          err.stack,
          context,
        );
      } else {
        this.subscribedConfigFeedbackDevices.add(uuid);
        this.loggingService.log(
          `Subscribed to config feedback topic: ${feedbackTopic}`,
          context,
        );
      }
    });
  }

  /**
   * Maneja feedback de configuración
   */
  private handleConfigFeedback(
    message: ConfigFeedbackMessage,
    deviceUuid: string,
  ): void {
    const context = 'MqttService.handleConfigFeedback';

    // Ejecutar async sin bloquear
    this.handleConfigFeedbackAsync(message, deviceUuid).catch((error) => {
      this.loggingService.error(
        `Error processing config feedback from device ${deviceUuid}`,
        (error as Error).stack,
        context,
      );
    });
  }

  private async handleConfigFeedbackAsync(
    message: ConfigFeedbackMessage,
    deviceUuid: string,
  ): Promise<void> {
    const context = 'MqttService.handleConfigFeedbackAsync';

    try {
      this.loggingService.log(
        `Config feedback from device ${deviceUuid}: ${JSON.stringify(message)}`,
        context,
      );

      // Resolver/rechazar Promise pendiente si existe
      const pending = this.pendingConfigs.get(deviceUuid);
      this.loggingService.log(
        `Checking pending config for ${deviceUuid}: ${pending ? 'found' : 'not found'}`,
        context,
      );
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingConfigs.delete(deviceUuid);

        if (message.status === 'success') {
          this.loggingService.log(
            `Resolving config feedback Promise for device ${deviceUuid}`,
            context,
          );
          pending.resolve(message);
        } else {
          this.loggingService.warn(
            `Rejecting config feedback Promise for device ${deviceUuid}: ${message.message}`,
            context,
          );
          pending.reject(
            new Error(message.message || 'Configuration failed on Arduino'),
          );
        }
      } else {
        this.loggingService.warn(
          `Config feedback received for ${deviceUuid} but no pending config found. Available pending configs: ${Array.from(this.pendingConfigs.keys()).join(', ')}`,
          context,
        );
      }

      // Llamar al callback si está registrado (para actualizar DB si es necesario)
      if (this.onConfigFeedbackCallback) {
        await this.onConfigFeedbackCallback(message, deviceUuid);
      } else {
        this.loggingService.debug(
          'Config feedback received but no callback registered',
          context,
        );
      }
    } catch (error) {
      this.loggingService.error(
        `Error processing config feedback from device ${deviceUuid}`,
        (error as Error).stack,
        context,
      );
    }
  }

  /**
   * Maneja feedback de comandos
   */
  private handleCommandFeedback(
    message: CommandFeedbackMessage,
    uuid: string,
  ): void {
    const context = 'MqttService.handleCommandFeedback';

    const pending = this.pendingCommands.get(message.requestId);
    if (!pending) {
      this.loggingService.warn(
        `Received command feedback with unknown requestId: ${message.requestId} from device ${uuid}`,
        context,
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(message.requestId);

    if (message.status === 'success') {
      this.loggingService.debug(
        `Command feedback success for requestId ${message.requestId} from device ${uuid}`,
        context,
      );
      pending.resolve(message);
    } else {
      this.loggingService.warn(
        `Command feedback error for requestId ${message.requestId} from device ${uuid}: ${message.message}`,
        context,
      );
      pending.reject(new Error(message.message || 'Command execution failed'));
    }
  }
}
