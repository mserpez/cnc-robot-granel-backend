import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dgram from 'dgram';
import * as os from 'os';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class UdpDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private server: dgram.Socket | null = null;
  private readonly discoveryPort: number;
  private readonly mqttBrokerHost: string;
  private readonly mqttBrokerPort: number;
  private readonly mqttBrokerUsername?: string;
  private readonly mqttBrokerPassword?: string;
  private readonly serverPort: number;
  private readonly useBrokerHostname: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {
    this.discoveryPort =
      this.configService.get<number>('UDP_DISCOVERY_PORT') ?? 1884;
    this.mqttBrokerHost =
      this.configService.get<string>('MQTT_BROKER_HOST') ?? 'localhost';
    this.mqttBrokerPort =
      this.configService.get<number>('MQTT_BROKER_PORT') ?? 1883;
    this.mqttBrokerUsername = this.configService.get<string>(
      'MQTT_BROKER_USERNAME',
    );
    this.mqttBrokerPassword = this.configService.get<string>(
      'MQTT_BROKER_PASSWORD',
    );
    this.serverPort =
      this.configService.get<number>('SERVER_PORT') ??
      this.configService.get<number>('PORT') ??
      3000;
    // Si el broker host no es localhost o una IP, usar hostname
    this.useBrokerHostname =
      this.mqttBrokerHost !== 'localhost' &&
      !this.mqttBrokerHost.match(/^\d+\.\d+\.\d+\.\d+$/);
  }

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private start(): void {
    const context = 'UdpDiscoveryService.start';
    this.loggingService.debug('Starting UDP discovery server', context);

    this.server = dgram.createSocket('udp4');

    this.server.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.server.on('error', (err) => {
      this.loggingService.error(
        'UDP discovery server error',
        err.stack,
        'UdpDiscoveryService',
      );
    });

    this.server.bind(this.discoveryPort, () => {
      this.loggingService.log(
        `UDP discovery server listening on port ${this.discoveryPort}`,
        'UdpDiscoveryService',
      );
    });
  }

  private stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.loggingService.log(
        'UDP discovery server stopped',
        'UdpDiscoveryService',
      );
    }
  }

  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const context = 'UdpDiscoveryService.handleMessage';
    const message = msg.toString('utf8').trim();

    this.loggingService.debug(
      `Received UDP message from ${rinfo.address}:${rinfo.port}: ${message}`,
      context,
    );

    if (message === 'CNC_GRANEL_DISCOVERY') {
      this.sendDiscoveryResponse(rinfo);
    } else {
      this.loggingService.debug(
        `Unknown discovery message: ${message}`,
        context,
      );
    }
  }

  private sendDiscoveryResponse(rinfo: dgram.RemoteInfo): void {
    const context = 'UdpDiscoveryService.sendDiscoveryResponse';

    const response: {
      broker_ip?: string;
      broker_host?: string;
      broker_port: number;
      broker_username?: string;
      broker_password?: string;
    } = {
      broker_port: this.mqttBrokerPort,
    };

    // Si es un hostname (como HiveMQ Cloud), devolver hostname
    if (this.useBrokerHostname) {
      response.broker_host = this.mqttBrokerHost;
    } else {
      // Si es IP local, devolver IP
      const brokerIP = this.getLocalIPAddress();
      if (!brokerIP) {
        this.loggingService.error(
          'Could not determine local IP address for MQTT broker',
          undefined,
          context,
        );
        return;
      }
      response.broker_ip = brokerIP;
    }

    // Agregar credenciales si están configuradas
    if (this.mqttBrokerUsername) {
      response.broker_username = this.mqttBrokerUsername;
    }
    if (this.mqttBrokerPassword) {
      response.broker_password = this.mqttBrokerPassword;
    }

    const responseJson = JSON.stringify(response);
    const responseBuffer = Buffer.from(responseJson);

    if (this.server) {
      this.server.send(
        responseBuffer,
        0,
        responseBuffer.length,
        rinfo.port,
        rinfo.address,
        (err) => {
          if (err) {
            this.loggingService.error(
              `Failed to send discovery response to ${rinfo.address}:${rinfo.port}`,
              err.stack,
              context,
            );
          } else {
            this.loggingService.debug(
              `Sent discovery response to ${rinfo.address}:${rinfo.port}: ${responseJson}`,
              context,
            );
          }
        },
      );
    }
  }

  private getLocalIPAddress(): string | null {
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

    return null;
  }
}
