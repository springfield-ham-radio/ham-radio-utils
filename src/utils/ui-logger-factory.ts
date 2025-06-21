import { LogLayer } from 'loglayer';
import { BaseTransport } from '@loglayer/transport';
import { UILogger } from './ui-logger.js';

/**
 * Custom LogLayer transport for capturing UI log entries.
 */
class UILogTransport extends BaseTransport<any> {
  #callback: (logEntry: any) => void;

  constructor(callback: (logEntry: any) => void) {
    // Pass a dummy logger to BaseTransport
    super({ logger: { log: () => {} }, id: 'ui-logger-transport', enabled: true });
    this.#callback = callback;
  }

  shipToLogger(params: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: params.logLevel,
      message: params.messages.join(' '),
      data: params.data,
      hasData: params.hasData,
    };
    this.#callback(logEntry);
    return [];
  }
}

export interface UILoggerConfig {
  enableConsoleDebug?: boolean;
  customTransport?: any;
}

export function createUILogger(config: UILoggerConfig = {}): UILogger {
  // By default, just print to console as JSON
  const defaultCallback = (logEntry: any) => {
    console.log(JSON.stringify(logEntry));
  };
  const transport = config.customTransport || new UILogTransport(defaultCallback);
  const logger = new LogLayer({
    transport,
    consoleDebug: config.enableConsoleDebug ?? false,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
}

export function createUILoggerWithCallback(callback: (logEntry: any) => void, config: UILoggerConfig = {}): UILogger {
  const transport = new UILogTransport(callback);
  const logger = new LogLayer({
    transport,
    consoleDebug: config.enableConsoleDebug ?? false,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
}
