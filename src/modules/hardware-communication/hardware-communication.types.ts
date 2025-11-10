import type {
  AxisEventKey,
  MotorCommandKey,
  SensorEventKey,
} from './hardware-communication.constants';

export interface UsbOutboundMessage {
  command: string;
  payload: Record<string, unknown>;
}

export interface UsbInboundMessage {
  status: 'ok' | 'error';
  data?: Record<string, unknown>;
  message?: string;
}

export interface UsbTransport {
  isOpen(): boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  write(message: UsbOutboundMessage): Promise<void>;
  read(): Promise<UsbInboundMessage>;
}

export interface MotorCommandPayload {
  command: MotorCommandKey;
  value?: number;
}

export interface AxisPosition {
  positionMm: number;
}

export type AxisMoveCallback = (data: AxisPosition) => void;
export type SensorCallback = (payload: unknown) => void;

export type AxisHandlersMap = Map<AxisEventKey, Set<AxisMoveCallback>>;
export type SensorHandlersMap = Map<SensorEventKey, Set<SensorCallback>>;
