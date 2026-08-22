import type { ILogLayer } from 'loglayer';

/**
 * UI Logger: Command-Level Logging for UI Display
 *
 * This module provides a specialized logger for capturing command-level information
 * that can be easily parsed and displayed in a UI. It captures details about
 * commands, data sent, data expected, and data received in a structured format.
 */

interface ProtocolContext {
  variables?: Map<string, unknown>;
}

/**
 * Generic protocol step interface for UI logging
 */
export type UIProtocolStep = Record<string, unknown>;

const hasDescription = (obj: unknown): obj is { description: string } =>
  typeof obj === 'object' && obj !== null && 'description' in obj && typeof (obj as Record<string, unknown>).description === 'string';

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

    const dataSent = context.variables && context.variables.get('lastSentData');
    const dataReceived = context.variables && context.variables.get('lastReceivedData');
    const dataExpected = this.getExpectedData(step);
    const dataChunks = commandType === 'read' && context.variables && context.variables.get('lastReadSegmentChunks');

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

    const dataSent = context.variables && context.variables.get('lastSentData');
    const dataExpected = this.getExpectedData(step);

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
    if ('read' in step) {
      return 'read';
    }
    if ('write' in step) {
      return 'write';
    }
    if ('send' in step || 'expect' in step) {
      return 'exchange';
    }
    return 'unknown';
  }

  private getStepDescription(step: UIProtocolStep): string {
    if (hasDescription(step)) {
      return step.description;
    }
    return 'No description';
  }

  private getExpectedData(step: UIProtocolStep): unknown {
    if ('read' in step && typeof step.read === 'object' && step.read !== null && 'expect' in step.read) {
      const read = step.read as { expect: unknown; ack?: { expect?: unknown } };
      return {
        expect: read.expect,
        ack: read.ack?.expect,
      };
    }
    if ('write' in step && typeof step.write === 'object' && step.write !== null && 'expect' in step.write) {
      return (step.write as { expect: unknown }).expect;
    }
    if ('expect' in step) {
      return step.expect;
    }
    return {};
  }
}
