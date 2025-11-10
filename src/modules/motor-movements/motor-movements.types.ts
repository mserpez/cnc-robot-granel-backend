import type { MotorCommandKey } from '../hardware-communication';

export interface MotorMovementJobPayload {
  command: MotorCommandKey;
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
