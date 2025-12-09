import type { DeviceId } from '../../constants/mqtt.constants';

/**
 * Discovery Message
 * Publicado en topic único 'cnc-granel/discovery'
 * deviceId puede ser 'server' o UUID del dispositivo
 */
export interface DiscoveryMessage {
  deviceId: DeviceId;
  status: 'online' | 'offline';
  ip?: string;
  boardName?: string;
  firmwareVersion?: string;
  timestamp?: string;
}

/**
 * Disconnection Message (LWT)
 * Publicado automáticamente por el broker cuando un dispositivo se desconecta inesperadamente
 * deviceId es el UUID del dispositivo que se desconectó
 */
export interface DisconnectionMessage {
  deviceId: DeviceId;
  reason?: string;
  timestamp?: string;
}

/**
 * Config Message (futuro)
 */
export interface ConfigMessage {
  // ... estructura de configuración
}

/**
 * Command Message (futuro)
 */
export interface CommandMessage {
  component: string;
  command: string;
  payload?: Record<string, unknown>;
}

/**
 * Heartbeat Message (futuro)
 */
export interface HeartbeatMessage {
  status: 'ready' | 'error';
  uptime?: number;
}

/**
 * Topic Types con Payloads Tipados
 * Mapea cada topic a su tipo de payload
 */
export type TopicPayloadMap = {
  'cnc-granel/discovery': DiscoveryMessage;
  'cnc-granel/disconnected': DisconnectionMessage;
  'cnc-granel/{uuid}/config': ConfigMessage;
  'cnc-granel/{uuid}/heartbeat': HeartbeatMessage;
  'cnc-granel/{uuid}/component/{component}/command': CommandMessage;
};

/**
 * Helper type para extraer payload de un topic
 */
export type TopicPayload<T extends keyof TopicPayloadMap> = TopicPayloadMap[T];

/**
 * Mensaje MQTT tipado genérico
 */
export interface TypedMqttMessage<T extends keyof TopicPayloadMap> {
  topic: T;
  payload: TopicPayloadMap[T];
  timestamp: Date;
}
