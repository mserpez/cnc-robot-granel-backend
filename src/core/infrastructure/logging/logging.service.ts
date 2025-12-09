import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_LOG_LEVEL, LOG_LEVELS, LogLevel } from './logging.constants';
import type { LoggingPort } from './logging.types';

type LogPayload = {
  context?: string;
  trace?: string;
};

@Injectable()
export class LoggingService implements LoggerService, LoggingPort {
  private readonly level: LogLevel;
  private readonly levelPriority: Map<LogLevel, number>;

  constructor(private readonly configService: ConfigService) {
    this.levelPriority = new Map(
      LOG_LEVELS.map((option, index) => [option, index]),
    );

    const configuredLevel =
      this.configService.get<string>('DEBUG_LEVEL') ?? DEFAULT_LOG_LEVEL;

    this.level = this.parseLevel(configuredLevel);
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, { context, trace });
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, { context });
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, { context });
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, { context });
  }

  private write(level: LogLevel, message: unknown, payload: LogPayload): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(message);
    const parts = [
      `[${level.toUpperCase()}]`,
      timestamp,
      payload.context ? `[${payload.context}]` : null,
      formattedMessage,
    ].filter(Boolean);

    const text = parts.join(' ');

    switch (level) {
      case 'error':
        console.error(text, payload.trace);
        break;
      case 'warn':
        console.warn(text);
        break;
      case 'debug':
        console.debug(text);
        break;
      case 'verbose':
        console.trace(text);
        break;
      default:
        console.log(text);
        break;
    }
  }

  private isLevelEnabled(level: LogLevel): boolean {
    const requiredPriority = this.levelPriority.get(level);
    const activePriority = this.levelPriority.get(this.level);

    if (requiredPriority === undefined || activePriority === undefined) {
      return false;
    }

    return requiredPriority <= activePriority;
  }

  private parseLevel(value: string): LogLevel {
    const normalized = value.toLowerCase();
    if (LOG_LEVELS.includes(normalized as LogLevel)) {
      return normalized as LogLevel;
    }

    return DEFAULT_LOG_LEVEL;
  }

  private formatMessage(input: unknown): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof Error) {
      return input.message;
    }

    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }
}
