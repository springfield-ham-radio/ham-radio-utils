import { describe, it } from 'node:test';
import { expect } from 'chai';
import { SchemaValidator } from '../src/utils/schema-validator.js';

// Baofeng UV-5R configuration from the example
const baofengConfig = {
  id: {
    model: 'baofeng-uv5r',
    name: 'Baofeng UV-5R',
    manufacturer: 'Baofeng',
  },
  settingsSchema: {
    model: 'baofeng-uv5r',
    settingsSchema: {},
    channelSchema: {},
  },
  serialConfig: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
  },
  memoryConfig: {
    chunkSize: 64,
    segments: {
      channels: {
        startAddress: 0,
        endAddress: 6143,
      },
      settings: {
        startAddress: 7872,
        endAddress: 8191,
      },
    },
  },
  readMemory: [
    {
      sendReceive: {
        send: [80, 187, 255, 32, 18, 7, 37],
        receive: {
          type: 'exact',
          value: 6,
          length: 1,
        },
        description: 'Send magic number',
      },
    },
    {
      sendReceive: {
        send: [2],
        receive: {
          type: 'variable',
          length: 8,
        },
        description: 'Get radio identifier',
      },
    },
    {
      sendReceive: {
        send: [6],
        receive: {
          type: 'exact',
          value: 6,
          length: 1,
        },
        description: 'Begin clone operation',
      },
    },
    {
      readSegment: {
        segments: ['channels', 'settings'],
        startChunk: {
          send: ['S', 'address:2', 'segment.chunkSize'],
          receive: {
            type: 'pattern',
            pattern: [
              'X',
              {
                field: 'address',
                size: 2,
              },
              {
                field: 'length',
                size: 1,
              },
              {
                field: 'data',
                size: 0,
              },
            ],
          },
        },
        endChunk: {
          send: [6],
          receive: {
            type: 'exact',
            value: 6,
            length: 1,
          },
        },
        description: 'Read all memory segments (single chunk per segment)',
      },
    },
  ],
  writeMemory: [
    {
      sendReceive: {
        send: [80, 187, 255, 32, 18, 7, 37],
        receive: {
          type: 'exact',
          value: 6,
          length: 1,
        },
        description: 'Send magic number',
      },
    },
    {
      writeSegment: {
        segments: ['channels', 'settings'],
        send: ['X', 'segment.startAddress:2', 'segment.chunkSize'],
        data: 'segment.data',
        receive: {
          type: 'exact',
          value: 6,
          length: 1,
        },
        description: 'Write all memory segments (single chunk per segment)',
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

    // Test missing required fields
    const invalidConfig = {
      id: {
        model: 'baofeng-uv5r',
        // Missing name and manufacturer
      },
      // Missing other required fields
    };

    const result = validator.validateRadioProtocol(invalidConfig);

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.length).to.be.greaterThan(0);
  });

  it('should validate serial configuration constraints', () => {
    const validator = new SchemaValidator();

    // Test invalid baud rate
    const invalidBaudRate = {
      ...baofengConfig,
      serialConfig: {
        ...baofengConfig.serialConfig,
        baudRate: 100, // Too low
      },
    };

    const result = validator.validateRadioProtocol(invalidBaudRate);

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.some((error) => error.includes('baudRate'))).to.be.true;
  });

  it('should validate memory segment constraints', () => {
    const validator = new SchemaValidator();

    // Test invalid memory addresses
    const invalidAddresses = {
      ...baofengConfig,
      memoryConfig: {
        ...baofengConfig.memoryConfig,
        segments: {
          channels: {
            startAddress: -1, // Invalid negative address
            endAddress: 6143,
          },
          settings: {
            startAddress: 7872,
            endAddress: 8191,
          },
        },
      },
    };

    const result = validator.validateRadioProtocol(invalidAddresses);

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.some((error) => error.includes('startAddress'))).to.be.true;
  });

  it('should validate protocol step structures', () => {
    const validator = new SchemaValidator();

    // Test invalid receive type
    const invalidReceiveType = {
      ...baofengConfig,
      readMemory: [
        {
          sendReceive: {
            send: [80, 187, 255, 32, 18, 7, 37],
            receive: {
              type: 'invalid_type', // Invalid type
              value: 6,
              length: 1,
            },
            description: 'Send magic number',
          },
        },
      ],
    };

    const result = validator.validateRadioProtocol(invalidReceiveType);

    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an('array');
    expect(result.errors!.some((error) => error.includes('type'))).to.be.true;
  });
});
