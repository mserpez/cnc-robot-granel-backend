// Configuración del LED
export interface LEDConfig {
  pin: number;
}

// Comandos disponibles
export type LEDCommand = 'on' | 'off';

// Payload para cada comando (mapeo comando → payload)
export interface LEDCommandPayloadMap {
  on: undefined; // Sin parámetros adicionales
  off: undefined; // Sin parámetros adicionales
}

// Tipo helper para obtener payload de un comando específico
export type LEDCommandPayload<T extends LEDCommand> = LEDCommandPayloadMap[T];

// Mensaje completo del comando (para MQTT)
export interface LEDCommandMessage<T extends LEDCommand = LEDCommand> {
  command: T;
  payload?: LEDCommandPayload<T>; // Opcional porque puede ser undefined
}

// Feedback del LED
export interface LEDFeedback {
  status: 'success' | 'error';
  message?: string;
  state?: boolean; // Estado actual del LED
}

// Payload para jobs de la queue (específico de LED)
export interface LEDJobPayload {
  deviceUuid: string;
  componentId: string;
  command: LEDCommand;
  payload?: LEDCommandPayload<LEDCommand>; // Opcional (puede ser undefined para comandos sin parámetros)
}
