import type { LogLayerTransport } from '@loglayer/shared';
// eslint-disable-next-line no-duplicate-imports, sort-imports
import { BaseTransport, type LogLayerTransportParams } from '@loglayer/transport';
import { LogLayer } from 'loglayer';
import { UILogger } from './ui-logger.js';

interface LogEntry {
  data: unknown;
  hasData: boolean;
  level: string;
  message: string;
  timestamp: string;
}

/**
 * Custom LogLayer transport for capturing UI log entries.
 */
const UILogTransport = class extends BaseTransport<unknown> {
  private callback: (logEntry: LogEntry) => void;

  constructor(callback: (logEntry: LogEntry) => void) {
    // Pass a dummy logger to BaseTransport
    super({
      enabled: true,
      id: 'ui-logger-transport',
      logger: {
        log: (): void => {
          // Empty function for dummy logger
        },
      },
    });
    this.callback = callback;
  }

  shipToLogger(params: LogLayerTransportParams): unknown[] {
    const logEntry: LogEntry = {
      data: params.data,
      hasData: params.hasData ?? false,
      level: params.logLevel,
      message: params.messages.join(' '),
      timestamp: new Date().toISOString(),
    };
    this.callback(logEntry);
    return [];
  }
};

export interface UILoggerConfig {
  customTransport?: LogLayerTransport;
  enableConsoleDebug?: boolean;
}

// Move defaultCallback to outer scope to avoid recreating it on every call
const defaultCallback = (logEntry: LogEntry): void => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logEntry));
};

export const createUILogger = function createUILogger(config: UILoggerConfig = {}): UILogger {
  const transport = config.customTransport || new UILogTransport(defaultCallback);
  const logger = new LogLayer({
    consoleDebug: config.enableConsoleDebug ?? false,
    transport,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
};

export const createUILoggerWithCallback = function createUILoggerWithCallback(callback: (logEntry: LogEntry) => void, config: UILoggerConfig = {}): UILogger {
  const transport = new UILogTransport(callback);
  const logger = new LogLayer({
    consoleDebug: config.enableConsoleDebug ?? false,
    transport,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
};
