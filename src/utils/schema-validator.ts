import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import radioProtocolSchema from '../schemas/radio-protocol-schema.json' with { type: 'json' };
import radioMemoryMapSchema from '../schemas/radio-memory-map-schema.json' with { type: 'json' };

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface AjvError {
  instancePath?: string;
  message?: string;
}

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
    });
    (addFormats as unknown as (ajv: Ajv) => Ajv)(this.ajv);
  }

  validateRadioProtocol(config: unknown): ValidationResult {
    const schemaResult = this.validateAgainst(radioProtocolSchema, config);

    if (!schemaResult.valid) {
      return schemaResult;
    }

    const baudRateErrors = baudRateMembershipErrors(config);

    if (baudRateErrors.length === 0) {
      return schemaResult;
    }

    return {
      valid: false,
      errors: baudRateErrors,
    };
  }

  validateMemoryMap(memoryMap: unknown): ValidationResult {
    return this.validateAgainst(radioMemoryMapSchema, memoryMap);
  }

  private validateAgainst(schema: object, data: unknown): ValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true };
    }

    let errors: string[] = [];

    if (validate.errors && validate.errors.length > 0) {
      errors = validate.errors.map((error: AjvError) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      });
    }

    return {
      errors,
      valid: false,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * `baudRate` is the default open speed. When a radio lists `baudRates`, that
 * default must be one of the accepted values so the UI can preselect it.
 */
function baudRateMembershipErrors(config: unknown): string[] {
  if (!isRecord(config) || !isRecord(config.serialConfig)) {
    return [];
  }

  const serialConfig = config.serialConfig;
  const baudRate = serialConfig.baudRate;
  const baudRates = serialConfig.baudRates;

  if (!Array.isArray(baudRates) || typeof baudRate !== 'number') {
    return [];
  }

  if (baudRates.includes(baudRate)) {
    return [];
  }

  return ['/serialConfig/baudRate: must be included in baudRates'];
}
