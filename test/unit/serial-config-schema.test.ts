import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

const radioConfig = {
  description: 'UV-5R and UV-5RE Plus models',
  id: {
    manufacturer: 'Baofeng',
    model: 'baofeng-uv5r',
    name: 'Baofeng UV-5R',
  },
  version: '1.0.0',
  memoryConfig: {
    addressEndianness: 'big',
    addressSize: 2,
    chunkSize: 64,
    segments: {
      channels: { endAddress: 6143, startAddress: 0 },
      settings: { endAddress: 8191, startAddress: 7872 },
    },
  },
  readMemory: [{ expect: '0x06', send: ['0x50'] }],
  serialConfig: {
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
  },
  settingsSchema: {
    channelSchema: {},
    model: 'baofeng-uv5r',
    settingsSchema: {},
  },
  writeMemory: [{ expect: '0x06', send: ['0x50'] }],
};

describe('serialConfig baudRates', () => {
  it('should accept baudRates that include the default baudRate', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol({
      ...radioConfig,
      serialConfig: {
        ...radioConfig.serialConfig,
        baudRate: 9600,
        baudRates: [9600, 19200, 38400, 57600],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject baudRates when the default baudRate is not in the list', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol({
      ...radioConfig,
      serialConfig: {
        ...radioConfig.serialConfig,
        baudRate: 9600,
        baudRates: [19200, 38400],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('baudRate'))).toBe(true);
    expect(result.errors!.some((error) => error.includes('baudRates'))).toBe(true);
  });

  it('should reject baudRates values outside the allowed range', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol({
      ...radioConfig,
      serialConfig: {
        ...radioConfig.serialConfig,
        baudRate: 9600,
        baudRates: [9600, 100],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('baudRates'))).toBe(true);
  });
});
