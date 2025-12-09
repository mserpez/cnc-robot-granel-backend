export type DashboardStatus = {
  server: {
    online: boolean;
    version: string;
  };
  database: {
    connected: boolean;
    error: string | null;
    name?: string;
    host?: string;
    port?: number;
  };
  redis: {
    connected: boolean;
    error: string | null;
    host?: string;
    port?: number;
  };
  mqtt: {
    connected: boolean;
    error: string | null;
    host?: string;
    port?: number;
    useTls?: boolean;
  };
  devices: {
    connected: number;
    total: number;
    list: Array<{
      uuid: string;
      status: string;
      lastSeen: Date | null;
      ip?: string;
    }>;
  };
};
