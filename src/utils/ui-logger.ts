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

/**
 * Generic protocol step interface for UI logging
 */
export interface UIProtocolStep {
  [key: string]: any;
}

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
  logCommandSuccess(stepIndex: number, totalSteps: number, operation: string, step: UIProtocolStep, context: any): void {
    const commandId = `${operation}-${stepIndex}`;
    const startTime = this.commandStartTimes.get(commandId) || Date.now();
    const endTime = Date.now();
    const duration = endTime - startTime;

    const commandType = this.getCommandType(step);
    const description = this.getStepDescription(step);

    // Extract sent and received data from context
    const dataSent = context.variables?.get('lastSentData');
    const dataReceived = context.variables?.get('lastReceivedData');
    const dataExpected = this.getExpectedData(step);

    // For readSegment, also extract chunk logs if present
    let dataChunks = undefined;
    if ('readSegment' === commandType) {
      dataChunks = context.variables?.get('lastReadSegmentChunks');
      // For readSegment, we don't need the flattened dataSent/dataReceived since we have dataChunks
    }

    // Convert dataSent and dataReceived to byte array format if they exist
    const dataSentArray = dataSent ? [...dataSent] : undefined;
    const dataReceivedArray = dataReceived ? [...dataReceived] : undefined;

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
  logCommandFailure(stepIndex: number, totalSteps: number, operation: string, step: UIProtocolStep, error: Error, context: any): void {
    const commandId = `${operation}-${stepIndex}`;
    const startTime = this.commandStartTimes.get(commandId) || Date.now();
    const endTime = Date.now();
    const duration = endTime - startTime;

    const commandType = this.getCommandType(step);
    const description = this.getStepDescription(step);

    // Extract sent data from context
    const dataSent = context.variables?.get('lastSentData');
    const dataExpected = this.getExpectedData(step);

    // Convert dataSent to byte array format if it exists
    const dataSentArray = dataSent ? [...dataSent] : undefined;

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
    if ('sendReceive' in step && step.sendReceive.description) {
      return step.sendReceive.description;
    }
    if ('send' in step && step.send.description) {
      return step.send.description;
    }
    if ('receive' in step && step.receive.description) {
      return step.receive.description;
    }
    if ('readSegment' in step && step.readSegment.description) {
      return step.readSegment.description;
    }
    if ('writeSegment' in step && step.writeSegment.description) {
      return step.writeSegment.description;
    }
    return 'No description';
  }

  private getExpectedData(step: UIProtocolStep): any {
    if ('sendReceive' in step && step.sendReceive.receive) {
      return step.sendReceive.receive;
    }
    if ('receive' in step) {
      return step.receive;
    }
    if ('readSegment' in step) {
      // For readSegment, return both start and end chunk receive patterns
      return {
        endChunk: step.readSegment.endChunk.receive,
        startChunk: step.readSegment.startChunk.receive,
        type: 'readSegment',
      };
    }
    return undefined;
  }
}
