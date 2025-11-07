# Sistema de Colas - Redis + BullMQ

## Arquitectura Simplificada

**Principio**: Un pedido = un producto + cantidad. Secuencia de comandos atómicos.

---

## Colas Principales

### 1. `orders:intake` (Entrada de Pedidos)
**Propósito**: Recepción y validación

**Input**:
```json
{
  "order_id": "uuid",
  "product_id": "uuid",
  "weight_grams": 500
}
```

**Proceso**:
1. Validar estructura
2. Verificar que producto existe y tiene tolva asignada
3. Verificar stock estimado
4. Calcular precio
5. Guardar en PostgreSQL (status: "pending")
6. Enviar a `orders:orchestrator`

**Concurrencia**: 10 workers
**Reintentos**: 3

---

### 2. `orders:orchestrator` (Orquestador)
**Propósito**: Convertir pedido en secuencia de movimientos

**Input**:
- order_id

**Proceso**:
1. Leer pedido de PostgreSQL
2. Obtener tolva del producto (hopper → y_position, side)
3. Generar secuencia de comandos
4. Encolar todos los comandos en `motors:queue` con order_id
5. Actualizar order status: "processing"

**Ejemplo de secuencia generada**:
```json
[
  { "order_id": "uuid", "type": "HOME", "axis": "ALL" },
  { "order_id": "uuid", "type": "MOVE_Y", "position": 500 },
  { "order_id": "uuid", "type": "MOVE_X", "position": -50 },
  { "order_id": "uuid", "type": "TARE_SCALE" },
  { 
    "order_id": "uuid",
    "type": "DISPENSE_Z",
    "target_weight": 500,
    "tolerance": 2,
    "max_speed": 100,
    "slow_speed": 30,
    "slow_threshold": 10
  },
  { "order_id": "uuid", "type": "MOVE_X", "position": 0, "verify_center": true },
  { "order_id": "uuid", "type": "MOVE_Y", "position": 5000 },
  { "order_id": "uuid", "type": "MOVE_A", "angle": 90 },
  { "order_id": "uuid", "type": "DELAY", "milliseconds": 2000 },
  { "order_id": "uuid", "type": "MOVE_A", "angle": 0 },
  { "order_id": "uuid", "type": "MOVE_Y", "position": 0 }
]
```

**Concurrencia**: 1 worker
**Reintentos**: 2

---

### 3. `motors:queue` (Cola de Motores - CRÍTICA)
**Propósito**: Ejecutar movimientos uno por uno en orden estricto

**Tipos de comandos**:

**Movimiento Y**
```json
{
  "order_id": "uuid",
  "type": "MOVE_Y",
  "position": 1000
}
```

**Movimiento X**
```json
{
  "order_id": "uuid",
  "type": "MOVE_X",
  "position": -50,
  "verify_center": false
}
```

**Rotación Z (Dispensado con peso objetivo)**
```json
{
  "order_id": "uuid",
  "type": "DISPENSE_Z",
  "target_weight": 500,
  "tolerance": 2,
  "max_speed": 100,
  "slow_speed": 30,
  "slow_threshold": 10
}
```

**Control A (Compuerta)**
```json
{
  "order_id": "uuid",
  "type": "MOVE_A",
  "angle": 90
}
```

**Tarar Balanza**
```json
{
  "order_id": "uuid",
  "type": "TARE_SCALE"
}
```

**Delay**
```json
{
  "order_id": "uuid",
  "type": "DELAY",
  "milliseconds": 2000
}
```

**Home**
```json
{
  "order_id": "uuid",
  "type": "HOME",
  "axis": "Y" | "X" | "Z" | "A" | "ALL"
}
```

**Proceso del Worker**:
1. Tomar comando de la cola
2. Verificar estado de máquina
3. Enviar comando a Arduino
4. Esperar respuesta
5. Actualizar estado de máquina (Redis)
6. Si es último comando del order_id → actualizar PostgreSQL (status: "completed")
7. Log en `dispense_logs`
8. Siguiente comando

**Concurrencia**: **1 worker**
**Reintentos**: 2 (excepto DISPENSE_Z: 1)
**FIFO estricto**

---

### 4. `calibration:positions` (Calibración de Posiciones de Tolvas)
**Propósito**: Detectar automáticamente posición de cada tolva

**Input**:
```json
{
  "machine_id": "uuid",
  "y_max": 6000
}
```

**Proceso**:
1. HOME del eje Y
2. X va a centro (verificar sensor)
3. Y inicia barrido desde 0 hasta y_max
4. Durante el barrido:
   - Sensores inductivos (izq/der) detectan marcas metálicas
   - Cada detección registra: posición Y + lado
5. Al finalizar barrido:
   - Crear/actualizar registros en tabla `hoppers`
   - Guardar calibration en PostgreSQL
6. Retornar array de posiciones detectadas

**Ejemplo de resultado**:
```json
{
  "detected_hoppers": [
    { "position": 100, "side": "left" },
    { "position": 200, "side": "right" },
    { "position": 300, "side": "left" },
    { "position": 400, "side": "right" }
  ],
  "total_detected": 4
}
```

**Concurrencia**: 1 worker
**Prioridad**: Urgent
**Reintentos**: 0 (requiere supervisión)

---

### 5. `calibration:scale` (Calibración de Balanza)
**Propósito**: Calibrar balanza con peso conocido

**Input**:
```json
{
  "machine_id": "uuid",
  "known_weight_grams": 1000
}
```

**Proceso**:

1. **Paso 1 - Primera medición con peso**:
   - Sistema solicita colocar peso conocido (ej: 1kg)
   - Operador coloca peso
   - Sistema lee valor RAW de balanza
   - Guarda: `raw_value_with_weight`

2. **Paso 2 - Retirar peso**:
   - Sistema solicita retirar peso
   - Operador retira peso
   - Sistema espera estabilización

3. **Paso 3 - Tara (punto cero)**:
   - Balanza vacía
   - Sistema ejecuta TARE
   - Sistema lee valor RAW
   - Guarda: `raw_value_zero`

4. **Paso 4 - Segunda medición con peso**:
   - Sistema solicita colocar peso nuevamente
   - Operador coloca peso
   - Sistema lee valor RAW
   - Guarda: `raw_value_with_weight_2`

5. **Paso 5 - Cálculo de escala**:
   - Diferencia RAW: `raw_diff = raw_value_with_weight_2 - raw_value_zero`
   - Factor de escala: `scale_factor = known_weight_grams / raw_diff`
   - Arduino guarda `scale_factor` en EEPROM

6. **Paso 6 - Verificación final**:
   - Sistema solicita mantener peso colocado
   - Sistema mide usando nuevo `scale_factor`
   - Peso medido debe estar en rango: `known_weight ± 5g`
   - Si OK → calibración exitosa
   - Si NO → solicitar repetir proceso

7. **Paso 7 - Registro**:
   - Guardar calibración en PostgreSQL tabla `calibrations`
   - Actualizar `machines.last_calibration_at`
   - Marcar `machine:state` scale.calibrated = true

**Concurrencia**: 1 worker
**Prioridad**: Urgent
**Reintentos**: 0 (proceso manual supervisado)

---

## Estado de Máquina (Redis Cache)
```
machine:state:{machine_id} = {
  status: "idle" | "busy" | "error" | "maintenance" | "calibrating",
  current_order_id: string | null,
  
  axes: {
    y: { position: 0, status: "ready" },
    x: { position: 0, at_center: true, status: "ready" },
    z: { rotating: false, speed: 0 },
    a: { angle: 0 }
  },
  
  sensors: {
    hopper_left_detected: false,
    hopper_right_detected: false,
    x_center_sensor: true,
    home_sensors: { y: true, x: true, z: true, a: true }
  },
  
  scale: {
    weight: 0,
    tared: false,
    calibrated: true,
    last_calibration: "2024-01-01T00:00:00Z"
  },
  
  last_command: "MOVE_Y",
  last_command_at: "2024-01-01T12:00:00Z",
  last_error: null
}
```

---

## Reglas Críticas

1. **Un pedido = un producto = una secuencia**
2. **X debe estar en centro antes de mover Y**
3. **Un comando a la vez (concurrencia = 1)**
4. **Estado se actualiza después de cada comando**
5. **Si falla DISPENSE_Z → abortar pedido**
6. **No procesar pedidos durante calibración**

---

## Manejo de Errores

- Movimientos: 2 reintentos
- Dispensado: 1 reintento → si falla, abortar
- Lecturas: 3 reintentos
- Calibraciones: 0 reintentos (manual)
- Fallo después de reintentos → order status: "failed"

**Dead Letter Queue**: `motors:failed`

---