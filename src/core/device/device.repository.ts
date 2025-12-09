import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DeviceEntity } from './device.types';

@Injectable()
export class DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo dispositivo
   */
  async create(data: {
    uuid: string;
    lastSeenOnlineAt: Date;
    ip?: string;
    firmwareVersion: string;
    boardName: string;
  }): Promise<DeviceEntity> {
    return this.prisma.device.create({
      data,
    });
  }

  /**
   * Buscar dispositivo por UUID
   */
  async findByUuid(uuid: string): Promise<DeviceEntity | null> {
    return this.prisma.device.findUnique({
      where: { uuid },
    });
  }

  /**
   * Actualizar dispositivo
   */
  async update(
    uuid: string,
    data: {
      lastSeenOnlineAt?: Date;
      ip?: string;
      firmwareVersion?: string;
      boardName?: string;
    },
  ): Promise<DeviceEntity> {
    return this.prisma.device.update({
      where: { uuid },
      data,
    });
  }

  /**
   * Obtener todos los dispositivos
   */
  async findAll(): Promise<DeviceEntity[]> {
    return this.prisma.device.findMany({
      orderBy: { lastSeenOnlineAt: 'desc' },
    });
  }

  /**
   * Actualizar solo lastSeenOnlineAt
   */
  async updateLastSeen(
    uuid: string,
    lastSeenOnlineAt: Date,
  ): Promise<DeviceEntity> {
    return this.prisma.device.update({
      where: { uuid },
      data: { lastSeenOnlineAt },
    });
  }
}
