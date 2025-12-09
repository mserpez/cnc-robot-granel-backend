# CNC Robot Granel Backend

Backend NestJS para el sistema CNC Robot Granel.

## Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

- `PORT`: Puerto HTTP del servidor (default: 3000)
- `SERVER_PORT`: Puerto del servidor para discovery (default: usa PORT si no está definido)
- `MQTT_BROKER_HOST`: Host del broker MQTT (default: localhost)
- `MQTT_BROKER_PORT`: Puerto del broker MQTT (default: 1883, usar 8883 para SSL/TLS)
- `MQTT_BROKER_USERNAME`: Usuario para autenticación MQTT (opcional)
- `MQTT_BROKER_PASSWORD`: Contraseña para autenticación MQTT (opcional)
- `MQTT_BROKER_USE_TLS`: Forzar uso de TLS/SSL (default: auto-detecta si puerto es 8883)
- `UDP_DISCOVERY_PORT`: Puerto UDP para discovery del broker MQTT (default: 1884)
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

El backend implementa un sistema de discovery que permite a los dispositivos Arduino descubrir el broker MQTT y el servidor backend:

1. **UDP Discovery**: Los dispositivos envían un broadcast UDP al puerto `UDP_DISCOVERY_PORT` con el mensaje `"CNC_GRANEL_DISCOVERY"`. El backend responde con la información del broker MQTT.

2. **MQTT Discovery**: Una vez conectados al broker MQTT, los dispositivos publican en `cnc-granel/discovery` con `deviceId` en el payload JSON. El backend registra el dispositivo (sin respuesta).

## Estructura de Topics MQTT

- `cnc-granel/discovery` - Device publica aquí para discovery (deviceId en payload JSON)
- `cnc-granel/{uuid}/heartbeat` - Heartbeat del device (futuro)
- `cnc-granel/{uuid}/config` - Configuración del device (futuro)
- `cnc-granel/{uuid}/component/+/command` - Comandos a componentes (futuro)

