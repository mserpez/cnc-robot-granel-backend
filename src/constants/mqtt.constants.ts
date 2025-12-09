/**
 * MQTT Topic Constants
 * Centralized topic definitions for MQTT communication
 */

const MQTT_BASE_PREFIX = 'cnc-granel';

/**
 * Device ID Constants
 */
export const SERVER_DEVICE_ID = 'server' as const;
export type DeviceId = string; // Puede ser SERVER_DEVICE_ID o UUID
export type DeviceUuid = string; // UUID de dispositivo

/**
 * Discovery Topics
 * Used for device discovery (unidirectional: device → backend)
 */
export const MQTT_TOPICS = {
  DISCOVERY: {
    // Topic único para discovery (deviceId viene en payload)
    TOPIC: `${MQTT_BASE_PREFIX}/discovery`,
  },
  DISCONNECTED: {
    // Topic único para LWT/disconexión (deviceId viene en payload)
    TOPIC: `${MQTT_BASE_PREFIX}/disconnected`,
  },
  SERVER: {
    // Server online broadcast topic
    ONLINE: `${MQTT_BASE_PREFIX}/server/online`,
  },
  DEVICE: {
    // Base prefix for device-specific topics
    PREFIX: `${MQTT_BASE_PREFIX}/`,
    // Build config topic for a device
    config: (uuid: DeviceUuid): string => `${MQTT_BASE_PREFIX}/${uuid}/config`,
    // Build heartbeat topic for a device
    heartbeat: (uuid: DeviceUuid): string =>
      `${MQTT_BASE_PREFIX}/${uuid}/heartbeat`,
    // Build command topic for a device component
    command: (uuid: DeviceUuid, component: string): string =>
      `${MQTT_BASE_PREFIX}/${uuid}/component/${component}/command`,
    // Pattern to subscribe to all commands for a device
    commandPattern: (uuid: DeviceUuid): string =>
      `${MQTT_BASE_PREFIX}/${uuid}/component/+/command`,
    // Build ping topic for a device
    ping: (uuid: DeviceUuid): string => `${MQTT_BASE_PREFIX}/${uuid}/ping`,
    // Build pong topic for a device
    pong: (uuid: DeviceUuid): string => `${MQTT_BASE_PREFIX}/${uuid}/pong`,
  },
} as const;

/**
 * Helper functions para validar deviceId
 */
export const isServerDevice = (
  deviceId: DeviceId,
): deviceId is typeof SERVER_DEVICE_ID => {
  return deviceId === SERVER_DEVICE_ID;
};

export const isDeviceUuid = (deviceId: DeviceId): deviceId is DeviceUuid => {
  return deviceId !== SERVER_DEVICE_ID;
};
