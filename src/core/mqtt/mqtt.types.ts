export interface DiscoveryRequest {
  status: 'online' | 'offline';
  ip?: string;
}

export interface DiscoveryResponse {
  server_ip: string;
  server_port: number;
  status: 'ready' | 'waiting_config' | 'error';
}

export interface MqttMessage<T = unknown> {
  topic: string;
  payload: T;
  timestamp: Date;
}
