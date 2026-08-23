import { describe, it } from 'node:test';
import { expect } from 'chai';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

describe('protocol schema write step', () => {
  it('accepts Chirp-style UV-5R write fields', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol({
      description: 'UV-5R write fields',
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
      serialConfig: { baudRate: 9600 },
      settingsSchema: {
        channelSchema: {},
        model: 'baofeng-uv5r',
        settingsSchema: {},
      },
      writeMemory: [
        { expect: '0x06', send: ['0x50', '0xBB', '0xFF', '0x20', '0x12', '0x07', '0x25'] },
        { expect: { bytes: 8 }, send: ['0x02'] },
        { expect: '0x06', send: ['0x06'] },
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
    });

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.undefined;
  });
});
