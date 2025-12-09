import type { Device } from '@prisma/client';

/**
 * DeviceEntity - Tipo base de Prisma
 * Extiende directamente el tipo generado por Prisma
 */
export type DeviceEntity = Device;

/**
 * DeviceInfo - Tipo extendido con campos calculados
 * Extiende DeviceEntity y agrega campos derivados para el servicio
 */
export interface DeviceInfo extends DeviceEntity {
  status: 'online' | 'offline'; // calculado desde lastSeenOnlineAt
  lastSeen: Date; // alias de lastSeenOnlineAt
}
