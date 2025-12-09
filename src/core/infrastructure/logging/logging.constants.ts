export const LOG_LEVELS = ['error', 'warn', 'log', 'debug', 'verbose'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEFAULT_LOG_LEVEL: LogLevel = 'log';
export const LOGGING_SERVICE_TOKEN = Symbol('LOGGING_SERVICE_TOKEN');
