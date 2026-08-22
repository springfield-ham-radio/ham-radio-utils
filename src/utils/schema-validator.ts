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
    return this.validateAgainst(radioProtocolSchema, config);
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
