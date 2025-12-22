import type { DeviceId } from '../../../constants/mqtt.constants';

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
 * Config Message
 */
export interface ConfigMessage {
  peripherals: Array<{
    componentId: string;
    type: string;
    config: Record<string, unknown>;
  }>;
}

/**
 * Command Message
 */
export interface CommandMessage {
  command: string;
  payload?: Record<string, unknown>;
  requestId: string;
  timestamp: number;
}

/**
 * Command Feedback Message
 * Respuesta del dispositivo confirmando ejecución de comando
 */
export interface CommandFeedbackMessage {
  requestId: string;
  status: 'success' | 'error';
  message?: string;
  timestamp: number;
}

/**
 * Config Feedback Message
 * Respuesta del dispositivo confirmando aplicación de configuración de periféricos
 */
export interface ConfigFeedbackMessage {
  status: 'success' | 'error';
  peripherals?: Array<{
    componentId: string;
    status: 'success' | 'error';
    message?: string;
  }>;
  message?: string;
  timestamp: number;
}

/**
 * Heartbeat Message (futuro)
 */
export interface HeartbeatMessage {
  status: 'ready' | 'error';
  uptime?: number;
}

/**
 * Ping Message
 * Enviado por el backend para verificar comunicación con un dispositivo
 */
export interface PingMessage {
  requestId: string; // UUID para correlacionar respuesta
  timestamp: number; // Timestamp del servidor en ms
}

/**
 * Pong Message
 * Respuesta del dispositivo al ping
 */
export interface PongMessage {
  requestId: string; // Mismo que el ping
  timestamp: number; // Timestamp del servidor original (para calcular RTT)
}

/**
 * Topic Types con Payloads Tipados
 * Mapea cada topic a su tipo de payload
 */
export type TopicPayloadMap = {
  'cnc-granel/discovery': DiscoveryMessage;
  'cnc-granel/disconnected': DisconnectionMessage;
  'cnc-granel/{uuid}/config': ConfigMessage;
  'cnc-granel/{uuid}/config/feedback': ConfigFeedbackMessage;
  'cnc-granel/{uuid}/heartbeat': HeartbeatMessage;
  'cnc-granel/{uuid}/component/{component}/command': CommandMessage;
  'cnc-granel/{uuid}/component/{component}/feedback': CommandFeedbackMessage;
  'cnc-granel/{uuid}/ping': PingMessage;
  'cnc-granel/{uuid}/pong': PongMessage;
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
