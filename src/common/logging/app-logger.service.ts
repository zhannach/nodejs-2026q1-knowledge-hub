import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { mkdirSync, renameSync, statSync, appendFileSync } from 'fs';
import { join } from 'path';
import { STATUS_CODES } from 'http';
import { sanitizeForLogging } from './sanitize-log-data';

type ConfiguredLogLevel = 'log' | 'debug' | 'warn' | 'error' | 'verbose';
type InternalLogLevel = ConfiguredLogLevel | 'fatal';

const LOG_LEVEL_PRIORITIES: Record<ConfiguredLogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

@Injectable()
export class AppLogger extends ConsoleLogger implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly configuredLevel = this.resolveConfiguredLevel();
  private readonly logsDirectory = join(process.cwd(), 'logs');
  private readonly logFilePath = join(this.logsDirectory, 'app.log');
  private readonly maxFileSizeBytes = this.resolveMaxFileSizeBytes();

  override log(message: unknown, context?: string) {
    this.writeLog('log', message, undefined, context);
  }

  override error(message: unknown, trace?: string, context?: string) {
    this.writeLog('error', message, undefined, context, trace);
  }

  override warn(message: unknown, context?: string) {
    this.writeLog('warn', message, undefined, context);
  }

  override debug(message: unknown, context?: string) {
    this.writeLog('debug', message, undefined, context);
  }

  override verbose(message: unknown, context?: string) {
    this.writeLog('verbose', message, undefined, context);
  }

  fatal(message: unknown, meta?: unknown, context?: string, trace?: string) {
    this.writeLog('fatal', message, meta, context, trace);
  }

  writeLog(
    level: InternalLogLevel,
    message: unknown,
    meta?: unknown,
    context?: string,
    trace?: string,
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const sanitizedMessage = sanitizeForLogging(message);
    const sanitizedMeta = sanitizeForLogging(meta);
    const renderedMessage =
      typeof sanitizedMessage === 'string'
        ? sanitizedMessage
        : JSON.stringify(sanitizedMessage);

    const record = {
      timestamp,
      level,
      context: context ?? this.context,
      message: renderedMessage,
      meta: sanitizedMeta,
      trace,
    };

    const line = this.isProduction
      ? `${JSON.stringify(record)}\n`
      : this.renderHumanReadableRecord(record);

    this.writeToConsole(level, line);
    this.writeToFile(line);
  }

  private shouldLog(level: InternalLogLevel) {
    if (level === 'fatal') {
      return true;
    }

    return (
      LOG_LEVEL_PRIORITIES[level] <= LOG_LEVEL_PRIORITIES[this.configuredLevel]
    );
  }

  private resolveConfiguredLevel(): ConfiguredLogLevel {
    const configuredLevel = process.env.LOG_LEVEL?.toLowerCase();

    if (
      configuredLevel &&
      Object.keys(LOG_LEVEL_PRIORITIES).includes(configuredLevel)
    ) {
      return configuredLevel as ConfiguredLogLevel;
    }

    return 'log';
  }

  private resolveMaxFileSizeBytes() {
    const parsedValue = Number.parseInt(
      process.env.LOG_MAX_FILE_SIZE ?? '1024',
      10,
    );

    const kilobytes =
      Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1024;

    return kilobytes * 1024;
  }

  private renderHumanReadableRecord(record: {
    timestamp: string;
    level: InternalLogLevel;
    context?: string;
    message: string;
    meta?: unknown;
    trace?: string;
  }) {
    const prefix = `[${record.timestamp}] ${record.level.toUpperCase()}`;
    const context = record.context ? ` [${record.context}]` : '';
    const meta =
      record.meta === undefined ? '' : ` ${JSON.stringify(record.meta)}`;
    const trace = record.trace ? `\n${record.trace}` : '';

    return `${prefix}${context} ${record.message}${meta}${trace}\n`;
  }

  private writeToConsole(level: InternalLogLevel, line: string) {
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }

  private writeToFile(line: string) {
    mkdirSync(this.logsDirectory, { recursive: true });
    this.rotateLogFileIfNeeded(Buffer.byteLength(line));
    appendFileSync(this.logFilePath, line, 'utf8');
  }

  private rotateLogFileIfNeeded(incomingBytes: number) {
    try {
      const stats = statSync(this.logFilePath);

      if (stats.size + incomingBytes <= this.maxFileSizeBytes) {
        return;
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, '')
        .replace(/:/g, '-');
      const rotatedFilePath = join(this.logsDirectory, `app-${timestamp}.log`);

      renameSync(this.logFilePath, rotatedFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const message =
          error instanceof Error ? error.message : STATUS_CODES[500];
        process.stderr.write(
          `[${new Date().toISOString()}] ERROR [Logger] Failed to rotate log file ${message}\n`,
        );
      }
    }
  }
}
