# Base de Datos

## PostgreSQL (Persistencia)

**Propósito**: Almacenamiento permanente de datos críticos del sistema

**Funciones**:
- Registro histórico de pedidos y operaciones
- Configuración del sistema y tolvas
- Inventario y stock
- Logs de calibraciones y mantenimiento
- Recuperación ante cortes de energía

## Redis (Colas y Cache)

**Propósito**: Procesamiento en tiempo real y gestión de colas

**Funciones**:
- Colas de procesamiento de pedidos (BullMQ)
- Estado actual de la máquina (cache)
- Jobs en progreso
- Coordinación entre workers


# Esquema de Base de Datos PostgreSQL

## Arquitectura de Despliegue

**Modelo**: Base de datos local por tenant (edge computing)

**Razones**:
- Independencia de conectividad a internet
- Latencia cero en operaciones críticas
- Máxima confiabilidad operativa
- Datos del tenant en su propia infraestructura

**Futuro**: Sincronización opcional con cloud para analytics y backup

---

# Esquema de Base de Datos PostgreSQL

## Arquitectura de Despliegue

**Modelo**: Base de datos local por tenant (edge computing)

**Razones**:
- Independencia de conectividad a internet
- Latencia cero en operaciones críticas
- Máxima confiabilidad operativa
- Datos del tenant en su propia infraestructura

**Futuro**: Sincronización opcional con cloud para analytics y backup

---

## Tablas Principales

### `config` (Configuración del Local)
- `id` (UUID, PK)
- `business_name` (string)
- `location` (string)
- `timezone` (string)
- `settings` (jsonb) - Configuraciones generales
- `created_at`, `updated_at`

### `machines` (Máquinas CNC)
- `id` (UUID, PK)
- `serial_number` (string, unique)
- `y_axis_length` (integer) - Longitud en mm (1000-6000)
- `max_hoppers` (integer) - Máximo de tolvas (20-120)
- `status` (enum: active, maintenance, offline)
- `last_calibration_at` (timestamp)
- `created_at`, `updated_at`

### `pet_types` (Tipos de Mascota)
- `id` (UUID, PK)
- `name` (string) - Perro, Gato, Ave, etc.
- `icon` (string, nullable) - Icono o emoji
- `order` (integer) - Orden de visualización
- `status` (enum: active, inactive)
- `synced_from_cloud` (boolean)
- `created_at`, `updated_at`

### `brands` (Marcas)
- `id` (UUID, PK)
- `name` (string)
- `logo_url` (string, nullable)
- `status` (enum: active, inactive)
- `synced_from_cloud` (boolean) - true si viene de catálogo cloud
- `created_at`, `updated_at`

### `products` (Productos de Alimento)
- `id` (UUID, PK)
- `brand_id` (UUID, FK → brands)
- `pet_type_id` (UUID, FK → pet_types)
- `name` (string)
- `description` (text)
- `price_per_kg` (decimal)
- `status` (enum: active, discontinued)
- `synced_from_cloud` (boolean) - true si viene de catálogo cloud
- `created_at`, `updated_at`

### `hoppers` (Tolvas)
- `id` (UUID, PK)
- `machine_id` (UUID, FK → machines)
- `position_index` (integer) - Índice en el array de posiciones
- `side` (enum: left, right)
- `y_position` (integer) - Posición en mm (calibrada)
- `product_id` (UUID, FK → products)
- `capacity_grams` (integer) - Capacidad máxima
- `current_stock_grams` (integer) - Stock actual estimado
- `status` (enum: active, empty, maintenance)
- `created_at`, `updated_at`

### `orders` (Pedidos)
- `id` (UUID, PK)
- `machine_id` (UUID, FK → machines)
- `order_number` (string, unique) - Número visible para cliente
- `customer_name` (string, nullable)
- `customer_phone` (string, nullable)
- `total_weight_grams` (integer)
- `total_amount` (decimal)
- `status` (enum: pending, processing, completed, failed, cancelled)
- `priority` (enum: normal, high, urgent)
- `started_at` (timestamp, nullable)
- `completed_at` (timestamp, nullable)
- `created_at`, `updated_at`

### `order_items` (Items del Pedido)
- `id` (UUID, PK)
- `order_id` (UUID, FK → orders)
- `hopper_id` (UUID, FK → hoppers)
- `product_id` (UUID, FK → products)
- `target_weight_grams` (integer)
- `actual_weight_grams` (integer, nullable)
- `sequence` (integer) - Orden de dispensado
- `status` (enum: pending, dispensing, completed, failed)
- `started_at` (timestamp, nullable)
- `completed_at` (timestamp, nullable)
- `created_at`, `updated_at`

### `calibrations` (Historial de Calibraciones)
- `id` (UUID, PK)
- `machine_id` (UUID, FK → machines)
- `type` (enum: 'scale', 'positions')
- `performed_by` (string) - Usuario/operador
- `status` (enum: 'success', 'failed', 'aborted')
- `results` (jsonb) - Datos específicos según tipo
- `notes` (text, nullable)
- `created_at`

**Estructura de `results` según tipo**:

**Para type = 'scale'**:
```json
{
  "known_weight_grams": 1000,
  "raw_value_with_weight": 123456,
  "raw_value_zero": 1234,
  "raw_value_with_weight_2": 123450,
  "raw_diff": 122216,
  "scale_factor": 0.008183,
  "verification_weight": 1002,
  "tolerance_ok": true
}
```

**Para type = 'positions'**:
```json
{
  "y_max": 6000,
  "scan_speed": 50,
  "detected_hoppers": [
    { "position": 100, "side": "left", "hopper_id": "uuid" },
    { "position": 200, "side": "right", "hopper_id": "uuid" },
    { "position": 300, "side": "left", "hopper_id": "uuid" }
  ],
  "total_detected": 3,
  "duration_seconds": 120
}
```

### `dispense_logs` (Log de Dispensados)
- `id` (UUID, PK)
- `order_item_id` (UUID, FK → order_items)
- `machine_id` (UUID, FK → machines)
- `hopper_id` (UUID, FK → hoppers)
- `target_weight` (integer)
- `final_weight` (integer)
- `tolerance` (integer) - Diferencia en gramos
- `duration_seconds` (integer)
- `status` (enum: success, failed, aborted)
- `error_message` (text, nullable)
- `created_at`

### `system_events` (Eventos del Sistema)
- `id` (UUID, PK)
- `machine_id` (UUID, FK → machines)
- `event_type` (enum: error, warning, info, maintenance)
- `component` (string) - Eje/sensor afectado
- `message` (text)
- `metadata` (jsonb)
- `created_at`



## Índices Principales
```sql
-- Búsqueda de pedidos por estado
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);

-- Búsqueda de tolvas por máquina
CREATE INDEX idx_hoppers_machine ON hoppers(machine_id);

-- Productos por tipo de mascota
CREATE INDEX idx_products_pet_type ON products(pet_type_id);

-- Productos por marca
CREATE INDEX idx_products_brand ON products(brand_id);

-- Logs de dispensado por pedido
CREATE INDEX idx_dispense_logs_order_item ON dispense_logs(order_item_id);

-- Eventos por máquina y fecha
CREATE INDEX idx_system_events_machine_date ON system_events(machine_id, created_at DESC);
```