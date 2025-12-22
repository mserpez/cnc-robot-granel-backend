import { PeripheralType, type Prisma } from '@prisma/client';
import type {
  LEDCommand,
  LEDCommandMessage,
  LEDConfig,
  LEDFeedback,
} from './leds';

// Re-exportar enum de Prisma
export { PeripheralType };

// Mapeo centralizado de tipos por PeripheralType
// Cada módulo exporta sus tipos y se agregan aquí
export interface PeripheralTypeMap {
  [PeripheralType.LED]: {
    Command: LEDCommand;
    CommandMessage: LEDCommandMessage;
    Feedback: LEDFeedback;
    Config: LEDConfig;
  };
  // Futuro: se agregan otros tipos aquí
}

// Tipos genéricos que usan el mapeo
export type PeripheralCommand<T extends PeripheralType> =
  PeripheralTypeMap[T]['Command'];

export type PeripheralCommandMessage<T extends PeripheralType> =
  PeripheralTypeMap[T]['CommandMessage'];

export type PeripheralFeedback<T extends PeripheralType> =
  PeripheralTypeMap[T]['Feedback'];

export type PeripheralConfig<T extends PeripheralType> =
  PeripheralTypeMap[T]['Config'];

// Helper para obtener el payload de un comando específico
// Uso: SendCommandPayload<PeripheralType.LED, 'on'>
export type SendCommandPayload<
  T extends PeripheralType,
  C extends PeripheralCommand<T>,
> =
  PeripheralCommandMessage<T> extends { command: C; payload?: infer P }
    ? P
    : never;

// Interfaces comunes
export interface PeripheralEntity {
  id: string;
  deviceUuid: string;
  componentId: string;
  type: PeripheralType;
  config: Prisma.JsonValue;
  state: Prisma.JsonValue | null;
  configStatus: string | null;
  configError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Alias para compatibilidad futura (puede extenderse con campos calculados)
export type PeripheralInfo = PeripheralEntity;

// Payload genérico para jobs de la queue (una sola cola para todos los periféricos)
export interface PeripheralCommandJobPayload {
  deviceUuid: string;
  componentId: string;
  type: PeripheralType;
  command: string; // Comando específico del tipo
  payload?: unknown; // Payload específico del comando (tipado por el módulo correspondiente)
}
