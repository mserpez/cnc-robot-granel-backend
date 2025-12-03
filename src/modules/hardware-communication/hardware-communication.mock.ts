import { MOTOR_COMMAND_KEYS } from './hardware-communication.constants';
import type {
  UsbInboundMessage,
  UsbOutboundMessage,
} from './hardware-communication.types';

interface MockHandlerContext {
  payload: UsbOutboundMessage['payload'];
  state: HardwareMockState;
}

interface MockDefinition {
  delayMs?: number;
  handler: (ctx: MockHandlerContext) => UsbInboundMessage;
}

type MotorCommand =
  (typeof MOTOR_COMMAND_KEYS)[keyof typeof MOTOR_COMMAND_KEYS];

interface HardwareMockState {
  currentWeight: number;
  axisPositions: Record<'X' | 'Y' | 'Z' | 'A', number>;
}

const MOCK_WEIGHT_PER_ROTATION = 50; // grams
const MOTOR_COMMAND_DELAY = 4000;
const SENSOR_DELAY = 500;

const state: HardwareMockState = {
  currentWeight: 0,
  axisPositions: { X: 0, Y: 0, Z: 0, A: 0 },
};

const ok = (data: Record<string, unknown> = {}): UsbInboundMessage => ({
  status: 'ok',
  data,
});

const setAxisPosition = (
  axis: keyof HardwareMockState['axisPositions'],
  value: number,
) => {
  state.axisPositions[axis] = value;
};

const commandHandlers: Record<string, MockDefinition> = {
  [MOTOR_COMMAND_KEYS.MOVE_Y_TO_HOPPER]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: ({ payload }) => {
      const hopperIndex = Number(payload.value ?? 0);
      setAxisPosition('Y', hopperIndex * 100);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_X_TO_CENTER]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('X', 0);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_X_TO_LEFT]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('X', -100);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_X_TO_RIGHT]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('X', 100);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_Z_LEFT_ROTATION]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: ({ payload }) => {
      const rotations = Number(payload.value ?? 0);
      state.currentWeight = Math.max(
        0,
        state.currentWeight - rotations * MOCK_WEIGHT_PER_ROTATION,
      );
      setAxisPosition('Z', state.axisPositions.Z - rotations * 10);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_Z_RIGHT_ROTATION]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: ({ payload }) => {
      const rotations = Number(payload.value ?? 0);
      state.currentWeight += rotations * MOCK_WEIGHT_PER_ROTATION;
      setAxisPosition('Z', state.axisPositions.Z + rotations * 10);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_A_OPEN]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('A', 90);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_A_CLOSE]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('A', 0);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_Y_HOME]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('Y', 0);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_X_HOME]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('X', 0);
      return ok();
    },
  },
  [MOTOR_COMMAND_KEYS.MOVE_A_HOME]: {
    delayMs: MOTOR_COMMAND_DELAY,
    handler: () => {
      setAxisPosition('A', 0);
      return ok();
    },
  },
  TARE_SCALE: {
    delayMs: SENSOR_DELAY,
    handler: () => {
      state.currentWeight = 0;
      return ok();
    },
  },
  GET_CURRENT_WEIGHT: {
    delayMs: SENSOR_DELAY,
    handler: () =>
      ok({
        weight: state.currentWeight,
      }),
  },
  GET_AXIS_POSITION: {
    delayMs: SENSOR_DELAY,
    handler: ({ payload }) => {
      const axis =
        typeof payload.axis === 'string'
          ? (payload.axis.toUpperCase() as keyof HardwareMockState['axisPositions'])
          : 'Y';
      return ok({ positionMm: state.axisPositions[axis] ?? 0 });
    },
  },
};

const defaultHandler: MockDefinition = {
  handler: () => ok(),
};

export async function simulateHardwareCommand(
  command: string,
  payload: UsbOutboundMessage['payload'],
): Promise<UsbInboundMessage> {
  const definition =
    commandHandlers[command as MotorCommand] ??
    commandHandlers[command] ??
    defaultHandler;
  if (definition.delayMs && definition.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, definition.delayMs));
  }
  return definition.handler({ payload, state });
}
