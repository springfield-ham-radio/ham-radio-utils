import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import radioProtocolSchema from '../schemas/radio-protocol-schema.json' assert { type: 'json' };

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
    });
    addFormats(this.ajv);
  }

  validateRadioProtocol(config: unknown): ValidationResult {
    const validate = this.ajv.compile(radioProtocolSchema);
    const valid = validate(config);

    if (valid) {
      return { valid: true };
    }

    const errors =
      validate.errors?.map((error) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }) || [];

    return {
      valid: false,
      errors,
    };
  }
}
