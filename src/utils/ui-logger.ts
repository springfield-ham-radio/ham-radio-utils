import type { ILogLayer } from 'loglayer';

/**
 * UI Logger: Command-Level Logging for UI Display
 *
 * This module provides a specialized logger for capturing command-level information
 * that can be easily parsed and displayed in a UI. It captures details about
 * commands, data sent, data expected, and data received in a structured format.
 *
 * Purpose:
 * - Captures command-level information for UI display
 * - Provides structured JSON logging for easy parsing
 * - Tracks command execution details including timing
 * - Supports protocol debugging in UI environments
 * - Maintains separation from debug logging
 *
 * Design Rationale:
 * - Single log entry per command provides clean UI display
 * - JSON structure enables easy parsing and filtering
 * - Command-level granularity is appropriate for UI debugging
 * - Structured data supports rich UI representations
 * - Separate from debug logging avoids UI noise
 */

interface ProtocolContext {
  variables?: Map<string, unknown>;
}

/**
 * Generic protocol step interface for UI logging
 */
export type UIProtocolStep = Record<string, unknown>;

/**
 * Type guards for protocol step properties
 */
const hasDescription = (obj: unknown): obj is { description: string } =>
  typeof obj === 'object' && obj !== null && 'description' in obj && typeof (obj as Record<string, unknown>).description === 'string';

const hasReceive = (obj: unknown): obj is { receive: unknown } => typeof obj === 'object' && obj !== null && 'receive' in obj;

const hasEndChunk = (obj: unknown): obj is { endChunk: { receive: unknown } } =>
  typeof obj === 'object' &&
  obj !== null &&
  'endChunk' in obj &&
  typeof (obj as Record<string, unknown>).endChunk === 'object' &&
  (obj as Record<string, unknown>).endChunk !== null &&
  'receive' in ((obj as Record<string, unknown>).endChunk as Record<string, unknown>);

const hasStartChunk = (obj: unknown): obj is { startChunk: { receive: unknown } } =>
  typeof obj === 'object' &&
  obj !== null &&
  'startChunk' in obj &&
  typeof (obj as Record<string, unknown>).startChunk === 'object' &&
  (obj as Record<string, unknown>).startChunk !== null &&
  'receive' in ((obj as Record<string, unknown>).startChunk as Record<string, unknown>);

/**
 * UI Logger for capturing command-level information for UI display
 */
export class UILogger {
  private logger: ILogLayer;
  private commandStartTimes = new Map<string, number>();

  constructor(logger: ILogLayer) {
    this.logger = logger;
  }

  // eslint-disable-next-line max-params
  startCommand(stepIndex: number, totalSteps: number, operation: string, step: UIProtocolStep): void {
    const commandId = `${operation}-${stepIndex}`;
    const startTime = Date.now();
    this.commandStartTimes.set(commandId, startTime);

    const commandType = this.getCommandType(step);
    const description = this.getStepDescription(step);

    this.logger
      .withMetadata({
        commandId,
        commandType,
        description,
        operation,
        startTime,
        stepIndex,
        totalSteps,
      })
      .info('Command started');
  }

  // eslint-disable-next-line max-params
  logCommandSuccess(stepIndex: number, totalSteps: number, operation: string, step: UIProtocolStep, context: ProtocolContext): void {
    const commandId = `${operation}-${stepIndex}`;
    const startTime = this.commandStartTimes.get(commandId) || Date.now();
    const endTime = Date.now();
    const duration = endTime - startTime;

    const commandType = this.getCommandType(step);
    const description = this.getStepDescription(step);

    // Extract sent and received data from context
    const dataSent = context.variables && context.variables.get('lastSentData');
    const dataReceived = context.variables && context.variables.get('lastReceivedData');
    const dataExpected = this.getExpectedData(step);

    // For readSegment, also extract chunk logs if present
    const dataChunks = commandType === 'readSegment' && context.variables && context.variables.get('lastReadSegmentChunks');

    // Convert dataSent and dataReceived to byte array format if they exist
    // eslint-disable-next-line unicorn/prefer-spread
    const dataSentArray = dataSent && Array.from(dataSent as Uint8Array);
    // eslint-disable-next-line unicorn/prefer-spread
    const dataReceivedArray = dataReceived && Array.from(dataReceived as Uint8Array);

    this.logger
      .withMetadata({
        commandType,
        dataChunks,
        dataExpected,
        dataReceived: dataReceivedArray,
        dataSent: dataSentArray,
        description,
        duration,
        endTime,
        operation,
        startTime,
        stepIndex,
        success: true,
        totalSteps,
      })
      .info('Command completed successfully');
  }

  // eslint-disable-next-line max-params
  logCommandFailure(stepIndex: number, totalSteps: number, operation: string, step: UIProtocolStep, error: Error, context: ProtocolContext): void {
    const commandId = `${operation}-${stepIndex}`;
    const startTime = this.commandStartTimes.get(commandId) || Date.now();
    const endTime = Date.now();
    const duration = endTime - startTime;

    const commandType = this.getCommandType(step);
    const description = this.getStepDescription(step);

    // Extract sent data from context
    const dataSent = context.variables && context.variables.get('lastSentData');
    const dataExpected = this.getExpectedData(step);

    // Convert dataSent to byte array format if it exists
    // eslint-disable-next-line unicorn/prefer-spread
    const dataSentArray = dataSent && Array.from(dataSent as Uint8Array);

    this.logger
      .withMetadata({
        commandType,
        dataExpected,
        dataSent: dataSentArray,
        description,
        duration,
        endTime,
        error: error.message,
        operation,
        startTime,
        stepIndex,
        success: false,
        totalSteps,
      })
      .info('Command failed');
  }

  private getCommandType(step: UIProtocolStep): string {
    if ('sendReceive' in step) {
      return 'sendReceive';
    }
    if ('send' in step) {
      return 'send';
    }
    if ('receive' in step) {
      return 'receive';
    }
    if ('readSegment' in step) {
      return 'readSegment';
    }
    if ('writeSegment' in step) {
      return 'writeSegment';
    }
    if ('setVariable' in step) {
      return 'setVariable';
    }
    return 'unknown';
  }

  private getStepDescription(step: UIProtocolStep): string {
    if ('sendReceive' in step && hasDescription(step.sendReceive)) {
      return step.sendReceive.description;
    }
    if ('send' in step && hasDescription(step.send)) {
      return step.send.description;
    }
    if ('receive' in step && hasDescription(step.receive)) {
      return step.receive.description;
    }
    if ('readSegment' in step && hasDescription(step.readSegment)) {
      return step.readSegment.description;
    }
    if ('writeSegment' in step && hasDescription(step.writeSegment)) {
      return step.writeSegment.description;
    }
    return 'No description';
  }

  private getExpectedData(step: UIProtocolStep): unknown {
    if ('sendReceive' in step && hasReceive(step.sendReceive)) {
      return step.sendReceive.receive;
    }
    if ('receive' in step) {
      return step.receive;
    }
    if ('readSegment' in step) {
      // For readSegment, return both start and end chunk receive patterns
      const { readSegment } = step;
      if (hasEndChunk(readSegment) && hasStartChunk(readSegment)) {
        return {
          endChunk: readSegment.endChunk.receive,
          startChunk: readSegment.startChunk.receive,
          type: 'readSegment',
        };
      }
    }
    return {};
  }
}
