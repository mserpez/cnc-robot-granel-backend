import { Injectable } from '@nestjs/common';
import { PeripheralType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PeripheralEntity } from './peripheral-coordinator.types';

@Injectable()
export class PeripheralCoordinatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    deviceUuid: string;
    componentId: string;
    type: PeripheralType;
    config: Prisma.InputJsonValue;
    state?: Prisma.InputJsonValue | null;
    configStatus?: string | null;
    configError?: string | null;
  }): Promise<PeripheralEntity> {
    return this.prisma.peripheral.create({
      data: {
        deviceUuid: data.deviceUuid,
        componentId: data.componentId,
        type: data.type,
        config: data.config,
        state: data.state ?? Prisma.JsonNull,
        configStatus: data.configStatus ?? null,
        configError: data.configError ?? null,
      },
    });
  }

  async findByUuid(id: string): Promise<PeripheralEntity | null> {
    return this.prisma.peripheral.findUnique({
      where: { id },
    });
  }

  async findByDeviceAndComponent(
    deviceUuid: string,
    componentId: string,
  ): Promise<PeripheralEntity | null> {
    return this.prisma.peripheral.findUnique({
      where: {
        deviceUuid_componentId: {
          deviceUuid,
          componentId,
        },
      },
    });
  }

  async findByDevice(deviceUuid: string): Promise<PeripheralEntity[]> {
    return this.prisma.peripheral.findMany({
      where: { deviceUuid },
    });
  }

  async update(
    id: string,
    data: {
      config?: Prisma.InputJsonValue;
      state?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
      configStatus?: string | null;
      configError?: string | null;
    },
  ): Promise<PeripheralEntity> {
    return this.prisma.peripheral.update({
      where: { id },
      data,
    });
  }

  async updateConfigStatus(
    deviceUuid: string,
    componentId: string,
    status: string | null,
    error?: string | null,
  ): Promise<PeripheralEntity> {
    const peripheral = await this.findByDeviceAndComponent(
      deviceUuid,
      componentId,
    );
    if (!peripheral) {
      throw new Error(
        `Peripheral with componentId ${componentId} not found for device ${deviceUuid}`,
      );
    }

    return this.prisma.peripheral.update({
      where: { id: peripheral.id },
      data: {
        configStatus: status,
        configError: error ?? null,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.peripheral.delete({
      where: { id },
    });
  }
}
