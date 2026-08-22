import { describe, it } from 'node:test';
import { SchemaValidator } from '../src/utils/schema-validator.js';
import { expect } from 'chai';

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

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.undefined;
  });

  it('should reject invalid configurations', () => {
    const validator = new SchemaValidator();

    const invalidConfig = {
      id: {
        model: 'baofeng-uv5r',
      },
    };

    const result = validator.validateRadioProtocol(invalidConfig);

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.length).to.be.greaterThan(0);
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

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.some((error) => error.includes('baudRate'))).to.be.true;
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

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.some((error) => error.includes('startAddress'))).to.be.true;
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

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.length).to.be.greaterThan(0);
  });
});
