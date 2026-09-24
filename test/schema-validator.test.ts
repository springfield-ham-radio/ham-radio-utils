import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../src/utils/schema-validator.js';

const baofengConfig = {
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
      channels: {
        endAddress: 6143,
        startAddress: 0,
      },
      settings: {
        endAddress: 8191,
        startAddress: 7872,
      },
    },
  },
  readMemory: [
    {
      description: 'Send magic number',
      send: ['0x50', '0xBB', '0xFF', '0x20', '0x12', '0x07', '0x25'],
      expect: '0x06',
    },
    {
      description: 'Get radio identifier',
      send: ['0x02'],
      expect: { bytes: 8 },
    },
    {
      description: 'Begin clone operation',
      send: ['0x06'],
      expect: '0x06',
    },
    {
      description: 'Read memory',
      read: {
        segments: ['channels', 'settings'],
        send: ['S', '$address', '$chunkSize'],
        expect: ['X', '$address', '$length', '$data'],
        ack: {
          send: ['0x06'],
          expect: '0x06',
        },
      },
    },
  ],
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
  writeMemory: [
    {
      description: 'Send magic number',
      send: ['0x50', '0xBB', '0xFF', '0x20', '0x12', '0x07', '0x25'],
      expect: '0x06',
    },
    {
      description: 'Write memory',
      write: {
        segments: ['channels', 'settings'],
        send: ['X', '$address', '$chunkSize', '$data'],
        expect: '0x06',
      },
    },
  ],
};

describe('SchemaValidator', () => {
  it('should validate a valid Baofeng UV-5R configuration', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol(baofengConfig);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject invalid configurations', () => {
    const validator = new SchemaValidator();

    const invalidConfig = {
      id: {
        model: 'baofeng-uv5r',
      },
    };

    const result = validator.validateRadioProtocol(invalidConfig);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should validate serial configuration constraints', () => {
    const validator = new SchemaValidator();

    const invalidBaudRate = {
      ...baofengConfig,
      serialConfig: {
        ...baofengConfig.serialConfig,
        baudRate: 100,
      },
    };

    const result = validator.validateRadioProtocol(invalidBaudRate);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('baudRate'))).toBe(true);
  });

  it('should accept serialConfig baudRates that include the default baudRate', () => {
    const validator = new SchemaValidator();

    const result = validator.validateRadioProtocol({
      ...baofengConfig,
      serialConfig: {
        ...baofengConfig.serialConfig,
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
      ...baofengConfig,
      serialConfig: {
        ...baofengConfig.serialConfig,
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
      ...baofengConfig,
      serialConfig: {
        ...baofengConfig.serialConfig,
        baudRate: 9600,
        baudRates: [9600, 100],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('baudRates'))).toBe(true);
  });

  it('should validate memory segment constraints', () => {
    const validator = new SchemaValidator();

    const invalidAddresses = {
      ...baofengConfig,
      memoryConfig: {
        ...baofengConfig.memoryConfig,
        segments: {
          channels: {
            endAddress: 6143,
            startAddress: -1,
          },
          settings: {
            endAddress: 8191,
            startAddress: 7872,
          },
        },
      },
    };

    const result = validator.validateRadioProtocol(invalidAddresses);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.some((error) => error.includes('startAddress'))).toBe(true);
  });

  it('should reject protocol steps that are not an exchange, read, or write', () => {
    const validator = new SchemaValidator();

    const invalidStep = {
      ...baofengConfig,
      readMemory: [
        {
          description: 'Not a valid step',
        },
      ],
    };

    const result = validator.validateRadioProtocol(invalidStep);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should validate write steps with chunkSize, delay, and skip', () => {
    const validator = new SchemaValidator();

    const writeConfig = {
      ...baofengConfig,
      writeMemory: [
        {
          description: 'Send magic number',
          send: ['0x50', '0xBB', '0xFF', '0x20', '0x12', '0x07', '0x25'],
          expect: '0x06',
        },
        {
          description: 'Get radio identifier',
          send: ['0x02'],
          expect: { bytes: 8 },
        },
        {
          description: 'Begin clone operation',
          send: ['0x06'],
          expect: '0x06',
        },
        {
          description: 'Write memory',
          write: {
            chunkSize: 16,
            delay: 50,
            expect: '0x06',
            segments: ['channels', 'settings'],
            send: ['X', '$address', '$length', '$data'],
            skip: [
              { endAddress: 3327, startAddress: 3312 },
              { endAddress: 3583, startAddress: 3568 },
            ],
          },
        },
      ],
    };

    const result = validator.validateRadioProtocol(writeConfig);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});
