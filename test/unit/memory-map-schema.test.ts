import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

describe('memory-map schema groups', () => {
  it('accepts a memory map that declares settings groups', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      version: '1.0.0',
      description: 'Example',
      groups: [
        {
          id: 'basic',
          label: 'Basic Settings',
          icon: 'i-lucide-sliders-horizontal',
          groups: [{ id: 'receive', label: 'Receive' }],
        },
        {
          id: 'service',
          label: 'Service Settings',
          warning: {
            title: 'Service calibration values',
            description: 'Change only with appropriate test equipment.',
          },
        },
      ],
      structs: [
        {
          id: 'settings',
          seek: '0x0E20',
          fields: [
            {
              id: 'squelch',
              type: 'u8',
              value: { kind: 'integer', min: 0, max: 9 },
              ui: { group: 'basic', subgroup: 'receive', label: 'Squelch', widget: 'integer' },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects a settings group that is missing a label', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [{ id: 'squelch', type: 'u8' }],
        },
      ],
      groups: [{ id: 'basic' }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('label'))).toBe(true);
  });
});
