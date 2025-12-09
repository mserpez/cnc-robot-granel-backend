# CNC Robot Granel Backend

Backend NestJS para el sistema CNC Robot Granel.

## Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

- `PORT`: Puerto HTTP del servidor (default: 3000)
- `MQTT_BROKER_HOST`: Host del broker MQTT (default: localhost)
- `MQTT_BROKER_PORT`: Puerto del broker MQTT (default: 1883, usar 8883 para SSL/TLS)
- `MQTT_BROKER_USERNAME`: Usuario para autenticación MQTT (opcional)
- `MQTT_BROKER_PASSWORD`: Contraseña para autenticación MQTT (opcional)
- `MQTT_BROKER_USE_TLS`: Forzar uso de TLS/SSL (default: auto-detecta si puerto es 8883)
- `DEBUG_LEVEL`: Nivel de logging (default: debug)

### Ejemplo para HiveMQ Cloud

```env
MQTT_BROKER_HOST=tu-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_BROKER_USERNAME=tu-usuario
MQTT_BROKER_PASSWORD=tu-password
MQTT_BROKER_USE_TLS=true
```

## Discovery MQTT

Los dispositivos Arduino se conectan directamente al broker MQTT (configuración hardcodeada en el firmware). Una vez conectados, publican en `cnc-granel/discovery` con `deviceId` en el payload JSON. El backend registra el dispositivo en PostgreSQL (sin respuesta).

## Estructura de Topics MQTT

- `cnc-granel/discovery` - Device publica aquí para discovery (deviceId en payload JSON)
- `cnc-granel/{uuid}/heartbeat` - Heartbeat del device (futuro)
- `cnc-granel/{uuid}/config` - Configuración del device (futuro)
- `cnc-granel/{uuid}/component/+/command` - Comandos a componentes (futuro)

