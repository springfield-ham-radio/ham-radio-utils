import { describe, it } from 'node:test';
import { SchemaValidator } from '../src/utils/schema-validator.js';
import { expect } from 'chai';

// Baofeng UV-5R configuration from the example
const baofengConfig = {
  id: {
    manufacturer: 'Baofeng',
    model: 'baofeng-uv5r',
    name: 'Baofeng UV-5R',
  },
  memoryConfig: {
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
      sendReceive: {
        description: 'Send magic number',
        receive: {
          length: 1,
          type: 'exact',
          value: 6,
        },
        send: [80, 187, 255, 32, 18, 7, 37],
      },
    },
    {
      sendReceive: {
        description: 'Get radio identifier',
        receive: {
          length: 8,
          type: 'variable',
        },
        send: [2],
      },
    },
    {
      sendReceive: {
        description: 'Begin clone operation',
        receive: {
          length: 1,
          type: 'exact',
          value: 6,
        },
        send: [6],
      },
    },
    {
      readSegment: {
        description: 'Read all memory segments (single chunk per segment)',
        endChunk: {
          receive: {
            length: 1,
            type: 'exact',
            value: 6,
          },
          send: [6],
        },
        segments: ['channels', 'settings'],
        startChunk: {
          receive: {
            pattern: [
              'X',
              {
                field: 'address',
                size: 2,
              },
              {
                field: 'data',
                size: 0,
              },
              {
                field: 'length',
                size: 1,
              },
            ],
            type: 'pattern',
          },
          send: ['S', 'address:2', 'segment.chunkSize'],
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
      sendReceive: {
        description: 'Send magic number',
        receive: {
          length: 1,
          type: 'exact',
          value: 6,
        },
        send: [80, 187, 255, 32, 18, 7, 37],
      },
    },
    {
      writeSegment: {
        data: 'segment.data',
        description: 'Write all memory segments (single chunk per segment)',
        receive: {
          length: 1,
          type: 'exact',
          value: 6,
        },
        segments: ['channels', 'settings'],
        send: ['X', 'segment.startAddress:2', 'segment.chunkSize'],
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
            endAddress: 6143,
            startAddress: -1, // Invalid negative address
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

  it('should validate protocol step structures', () => {
    const validator = new SchemaValidator();

    // Test invalid receive type
    const invalidReceiveType = {
      ...baofengConfig,
      readMemory: [
        {
          sendReceive: {
            description: 'Send magic number',
            receive: {
              length: 1,
              type: 'invalid_type', // Invalid type
              value: 6,
            },
            send: [80, 187, 255, 32, 18, 7, 37],
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
