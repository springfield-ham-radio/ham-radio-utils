import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

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
              ui: {
                group: 'basic',
                subgroup: 'receive',
                label: 'Squelch',
                widget: 'integer',
                description: 'How strong a signal must be before the speaker opens.',
                menu: { number: 0, code: 'SQL' },
              },
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

  it('accepts an optional ui.section radio menu group name', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [
            {
              id: 'beep',
              type: 'u8',
              ui: {
                group: 'basic',
                section: 'Sound',
                label: 'Beep',
                widget: 'switch',
              },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects an empty ui.section', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [
            {
              id: 'beep',
              type: 'u8',
              ui: {
                group: 'basic',
                section: '',
                label: 'Beep',
                widget: 'switch',
              },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('section'))).toBe(true);
  });

  it('accepts an optional ui.sectionOrder of zero or greater', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [
            {
              id: 'beep',
              type: 'u8',
              ui: {
                group: 'basic',
                section: 'Sound',
                sectionOrder: 0,
                label: 'Beep',
                widget: 'switch',
              },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects a negative ui.sectionOrder', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [
            {
              id: 'beep',
              type: 'u8',
              ui: {
                group: 'basic',
                sectionOrder: -1,
                label: 'Beep',
                widget: 'switch',
              },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('sectionOrder'))).toBe(true);
  });

  it('accepts ascii and dtmf choices that store the character string', () => {
    const validator = new SchemaValidator();

    const result = validator.validateMemoryMap({
      structs: [
        {
          id: 'aprs',
          seek: '0x1367',
          fields: [
            {
              id: 'symbol',
              type: 'u8',
              value: {
                kind: 'ascii',
                length: 2,
                pad: 0,
                choices: [
                  { label: 'Radio', value: '\\Y' },
                  { label: 'RV', value: '/R' },
                ],
              },
              ui: { group: 'aprs', label: 'Icon', widget: 'select' },
            },
            {
              id: 'code',
              type: 'u8',
              value: {
                kind: 'dtmf',
                length: 5,
                choices: [{ label: 'None', value: '' }],
              },
            },
          ],
        },
      ],
    });

    expect(result.valid, result.errors?.join('; ')).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects an empty choice list, a blank label, and an extra choice property', () => {
    const validator = new SchemaValidator();
    const field = (choices: unknown) => ({
      structs: [
        {
          id: 'aprs',
          seek: 0,
          fields: [
            {
              id: 'symbol',
              type: 'u8',
              value: { kind: 'ascii', length: 2, choices },
            },
          ],
        },
      ],
    });

    expect(validator.validateMemoryMap(field([])).valid).toBe(false);
    expect(validator.validateMemoryMap(field([{ label: '', value: '\\Y' }])).valid).toBe(false);
    expect(validator.validateMemoryMap(field([{ label: 'Radio', value: '\\Y', code: 1 }])).valid).toBe(false);
  });

  it('validates the TH-D74 settings map, including menu 501 icon choices', () => {
    const validator = new SchemaValidator();
    const memoryMap = JSON.parse(readFileSync(join(fixtureDirectory, 'th-d74-settings.json'), 'utf8')) as {
      structs: Array<{ id: string; fields: Array<{ id: string; value?: { choices?: Array<{ label: string; value: string }> } }> }>;
    };

    const result = validator.validateMemoryMap(memoryMap);

    expect(result.valid, result.errors?.join('; ')).toBe(true);

    const icon = memoryMap.structs.find((struct) => struct.id === 'aprsIcon')?.fields.find((field) => field.id === 'symbol');
    expect(icon?.value?.choices?.find((choice) => choice.label === 'Radio')?.value).toBe('\\Y');
    expect(icon?.value?.choices?.find((choice) => choice.label === 'RV')?.value).toBe('/R');
  });
});
