import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { LoggingService } from '../logging/logging.service';
import { DeviceRepository } from './device.repository';
import type { DeviceEntity, DeviceInfo } from './device.types';

@Injectable()
export class DeviceService {
  private readonly deviceUpdates$ = new Subject<{
    type: 'connected' | 'disconnected' | 'updated';
    device: DeviceInfo;
  }>();
  private readonly HEARTBEAT_TIMEOUT_MS = 60000; // 60 segundos sin heartbeat = offline

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Registra o actualiza un dispositivo cuando se conecta o envía heartbeat
   */
  async registerDevice(
    uuid: string,
    ip?: string,
    boardName?: string,
    firmwareVersion?: string,
  ): Promise<void> {
    const context = 'DeviceService.registerDevice';
    const now = new Date();

    try {
      const existing = await this.deviceRepository.findByUuid(uuid);

      if (existing) {
        // Actualizar dispositivo existente
        const updateData: {
          lastSeenOnlineAt: Date;
          ip?: string;
        } = {
          lastSeenOnlineAt: now,
        };

        if (ip) {
          updateData.ip = ip;
        }

        const updated = await this.deviceRepository.update(uuid, updateData);
        const deviceInfo = this.toDeviceInfo(updated);
        this.deviceUpdates$.next({ type: 'updated', device: deviceInfo });

        this.loggingService.log(
          `Updated device ${uuid} - last seen: ${now.toISOString()}`,
          context,
        );
      } else {
        // Nuevo dispositivo - requiere boardName y firmwareVersion
        if (!boardName || !firmwareVersion) {
          this.loggingService.error(
            `Cannot create device ${uuid}: boardName and firmwareVersion are required`,
            undefined,
            context,
          );
          return;
        }

        const newDevice = await this.deviceRepository.create({
          uuid,
          lastSeenOnlineAt: now,
          ip,
          firmwareVersion,
          boardName,
        });

        const deviceInfo = this.toDeviceInfo(newDevice);
        this.deviceUpdates$.next({ type: 'connected', device: deviceInfo });

        this.loggingService.log(
          `New device connected: ${uuid}${ip ? ` (IP: ${ip})` : ''} - Board: ${boardName}, Firmware: ${firmwareVersion}`,
          context,
        );
      }
    } catch (error) {
      this.loggingService.error(
        `Error registering device ${uuid}`,
        (error as Error).stack,
        context,
      );
    }
  }

  /**
   * Obtiene todos los dispositivos
   */
  async getDevices(): Promise<DeviceInfo[]> {
    const entities = await this.deviceRepository.findAll();
    return entities.map((entity) => this.toDeviceInfo(entity));
  }

  /**
   * Obtiene dispositivos online (últimos 60 segundos)
   */
  async getOnlineDevices(): Promise<DeviceInfo[]> {
    const allDevices = await this.getDevices();
    return allDevices.filter((d) => d.status === 'online');
  }

  /**
   * Obtiene un dispositivo por UUID
   */
  async getDevice(uuid: string): Promise<DeviceInfo | null> {
    const entity = await this.deviceRepository.findByUuid(uuid);
    if (!entity) {
      return null;
    }
    return this.toDeviceInfo(entity);
  }

  /**
   * Observable para escuchar actualizaciones de dispositivos
   */
  getDeviceUpdates() {
    return this.deviceUpdates$.asObservable();
  }

  /**
   * Transforma DeviceEntity a DeviceInfo agregando campos calculados
   */
  private toDeviceInfo(entity: DeviceEntity): DeviceInfo {
    const now = Date.now();
    const lastSeenMs = entity.lastSeenOnlineAt.getTime();
    const timeSinceLastSeen = now - lastSeenMs;
    const isOnline = timeSinceLastSeen <= this.HEARTBEAT_TIMEOUT_MS;

    const deviceInfo: DeviceInfo = {
      ...entity,
      status: isOnline ? ('online' as const) : ('offline' as const),
      lastSeen: entity.lastSeenOnlineAt,
    };
    return deviceInfo;
  }
}
