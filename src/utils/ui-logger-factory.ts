import { BaseTransport } from '@loglayer/transport';
import { LogLayer } from 'loglayer';
import { UILogger } from './ui-logger.js';

/**
 * Custom LogLayer transport for capturing UI log entries.
 */
const UILogTransport = class extends BaseTransport<any> {
  #callback: (logEntry: any) => void;

  constructor(callback: (logEntry: any) => void) {
    // Pass a dummy logger to BaseTransport
    super({ enabled: true, id: 'ui-logger-transport', logger: { log: () => {} } });
    this.#callback = callback;
  }

  shipToLogger(params: any) {
    const logEntry = {
      data: params.data,
      hasData: params.hasData,
      level: params.logLevel,
      message: params.messages.join(' '),
      timestamp: new Date().toISOString(),
    };
    this.#callback(logEntry);
    return [];
  }
};

export interface UILoggerConfig {
  customTransport?: any;
  enableConsoleDebug?: boolean;
}

export const createUILogger = function createUILogger(config: UILoggerConfig = {}): UILogger {
  // By default, just print to console as JSON
  const defaultCallback = (logEntry: any) => {
    console.log(JSON.stringify(logEntry));
  };
  const transport = config.customTransport || new UILogTransport(defaultCallback);
  const logger = new LogLayer({
    consoleDebug: config.enableConsoleDebug ?? false,
    transport,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
};

export const createUILoggerWithCallback = function createUILoggerWithCallback(callback: (logEntry: any) => void, config: UILoggerConfig = {}): UILogger {
  const transport = new UILogTransport(callback);
  const logger = new LogLayer({
    consoleDebug: config.enableConsoleDebug ?? false,
    transport,
  });
  logger.setLevel('debug');
  return new UILogger(logger);
};
