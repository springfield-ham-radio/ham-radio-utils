import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import radioProtocolSchema from '../schemas/radio-protocol-schema.json' with { type: 'json' };

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
    const validate = this.ajv.compile(radioProtocolSchema);
    const valid = validate(config);

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
