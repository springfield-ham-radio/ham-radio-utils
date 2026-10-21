import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

const minimalProtocol = {
  description: 'onError schema tests',
  id: {
    manufacturer: 'Kenwood',
    model: 'kenwood-th-d74',
    name: 'Kenwood TH-D74',
  },
  version: '1.0.0',
  memoryConfig: {
    addressEndianness: 'big',
    addressSize: 2,
    chunkSize: 64,
    segments: {
      channels: { endAddress: 100, startAddress: 0 },
    },
  },
  readMemory: [{ send: ['0x50'], expect: '0x06' }],
  writeMemory: [{ send: ['0x50'], expect: '0x06' }],
  serialConfig: { baudRate: 9600 },
  settingsSchema: {
    channelSchema: {},
    model: 'kenwood-th-d74',
    settingsSchema: {},
  },
};

describe('protocol schema onError', () => {
  it('accepts readMemory cleanup with setBaudRate and send steps', () => {
    const validator = new SchemaValidator();

    const result = validator.validateRadioProtocol({
      ...minimalProtocol,
      onError: {
        readMemory: [{ setBaudRate: 57600 }, { send: ['E'] }],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('accepts writeMemory cleanup with a send step', () => {
    const validator = new SchemaValidator();

    const result = validator.validateRadioProtocol({
      ...minimalProtocol,
      onError: {
        writeMemory: [{ send: ['E'] }],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('accepts omitted onError and empty cleanup arrays', () => {
    const validator = new SchemaValidator();

    expect(validator.validateRadioProtocol(minimalProtocol).valid).toBe(true);

    const withEmpty = validator.validateRadioProtocol({
      ...minimalProtocol,
      onError: {
        readMemory: [],
        writeMemory: [],
      },
    });

    expect(withEmpty.valid).toBe(true);
    expect(withEmpty.errors).toBeUndefined();
  });

  it('rejects a read step inside onError', () => {
    const validator = new SchemaValidator();

    const result = validator.validateRadioProtocol({
      ...minimalProtocol,
      onError: {
        readMemory: [
          {
            read: {
              segments: ['channels'],
              send: ['S', '$address', '$chunkSize'],
              expect: ['X', '$address', '$length', '$data'],
            },
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('rejects unknown keys under onError', () => {
    const validator = new SchemaValidator();

    const result = validator.validateRadioProtocol({
      ...minimalProtocol,
      onError: {
        readMemory: [{ send: ['E'] }],
        finally: [{ send: ['E'] }],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('onError'))).toBe(true);
  });
});
