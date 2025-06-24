import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import radioProtocolSchema from '../schemas/radio-protocol-schema.json' with { type: 'json' };

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export class SchemaValidator {
  private ajv: any;

  constructor() {
    this.ajv = new (Ajv as any)({
      allErrors: true,
      verbose: true,
    });
    (addFormats as any)(this.ajv);
  }

  validateRadioProtocol(config: unknown): ValidationResult {
    const validate = this.ajv.compile(radioProtocolSchema);
    const valid = validate(config);

    if (valid) {
      return { valid: true };
    }

    const errors =
      validate.errors?.map((error: { instancePath?: string; message?: string }) => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }) || [];

    return {
      errors,
      valid: false,
    };
  }
}
