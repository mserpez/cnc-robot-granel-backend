# CNC Robot v3 - Dispensador Automatizado de Alimentos para Mascotas

Sistema automatizado que dispensa alimentos a granel con precisión. El cliente selecciona marca y cantidad, la máquina pesa exactamente lo solicitado usando tolvas independientes con tornillos sinfín.

## Configuración

- Dos grupos de tolvas enfrentadas con el eje Y en el medio
- Eje Y: 1 a 6 metros de recorrido
- Tolvas: espaciadas cada 100mm
- Cantidad: mínimo 20 tolvas, máximo 120 tolvas (60 por lado)
- El eje X se mueve hacia un lado u otro según dónde esté la tolva seleccionada

## Sensores de Seguridad

- **Eje Y**: Final de carrera en HOME
- **Eje X**: Final de carrera en HOME + Sensor inductivo en CENTRO (posición 0)
- **Eje Z**: Final de carrera en HOME
- **Eje A**: Final de carrera en HOME (compuerta cerrada)

## Sensores de Detección de Tolvas

- **2 sensores inductivos laterales en X**:
  - Sensor izquierdo: detecta tolvas del lado izquierdo
  - Sensor derecho: detecta tolvas del lado derecho
- **Marcas metálicas en cada tolva**: alineadas con el punto de conexión del eje Z (cada 100mm)
- **Función**: Calibración automática de posiciones mediante barrido del eje Y

## Calibración Automática de Posiciones

1. **Y hace HOME**
2. **X va a CENTRO** (confirmado por sensor)
3. **Y hace barrido completo** desde inicio hasta final (hasta 6m)
4. **Sensores detectan tolvas**: cada vez que un sensor inductivo detecta metal, registra posición Y
5. **Sistema guarda posiciones**: array de posiciones [tolva_izq_1, tolva_izq_2... tolva_der_1, tolva_der_2...]
6. **Listo**: sistema conoce ubicación exacta de todas las tolvas (entre 20 y 120)

## Reglas Críticas

1. **Y solo se mueve si X está en centro** (confirmado por sensor inductivo)
2. **Todos los ejes deben hacer HOME al iniciar**
3. **Backend debe trackear estado de todos los sensores antes de cada movimiento**
4. **Calibración de posiciones debe ejecutarse al inicio o cuando se reubiquen tolvas**

## Preparación de Pedido

1. **HOME**: Todos los motores en posición de origen (Y inicio, X centro, Z home, A cerrado)
2. **Y → Tolva**: Eje Y se posiciona frente a la tolva seleccionada (posición guardada)
3. **X → Conecta**: Eje X avanza hacia el lado correspondiente (+ o -) y conecta con el gusano
4. **Tara**: Balanza se pone en cero
5. **Z → Dispensa**: Eje Z gira el gusano, cae alimento
6. **Pesa**: Balanza monitorea peso en tiempo real
7. **Stop Z**: Detiene cuando alcanza peso objetivo
8. **X → Centro**: Eje X vuelve a 0 (confirmado por sensor inductivo)
9. **Y → Entrega**: Eje Y mueve producto a posición de entrega
10. **A → Descarga**: Compuerta se abre, producto cae al cliente