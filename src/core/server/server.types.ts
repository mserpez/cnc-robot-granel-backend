export interface DatabaseInfo {
  name?: string;
  host?: string;
  port?: number;
}

export interface RedisInfo {
  host?: string;
  port?: number;
}

export interface MqttInfo {
  host?: string;
  port?: number;
  useTls?: boolean;
}

export interface ServiceHealthStatus {
  database: {
    connected: boolean;
    error: string | null;
    info: DatabaseInfo;
  };
  redis: {
    connected: boolean;
    error: string | null;
    info: RedisInfo;
  };
  mqtt: {
    connected: boolean;
    error: string | null;
    info: MqttInfo;
  };
}

