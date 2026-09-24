import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

describe('protocol schema CAT memory steps', () => {
  it('accepts Kenwood TH-F6 until expects and catRead/catWrite', () => {
    const validator = new SchemaValidator();
    const result = validator.validateRadioProtocol({
      description: 'TH-F6 live CAT fields',
      id: {
        manufacturer: 'Kenwood',
        model: 'kenwood-th-f6',
        name: 'Kenwood TH-F6',
      },
      version: '1.0.0',
      memoryConfig: {
        addressEndianness: 'big',
        addressSize: 2,
        chunkSize: 32,
        segments: {
          channels: { endAddress: 12799, startAddress: 0 },
          settings: { endAddress: 12927, startAddress: 12800 },
        },
      },
      readMemory: [
        { description: 'Identify radio', send: ['I', 'D', '0x0D'], expect: { until: '0x0D' }, timeout: 2000 },
        {
          description: 'Read memories via live CAT',
          catRead: {
            segment: 'channels',
            count: 400,
            recordSize: 32,
            pack: 'kenwood-th-f6',
            timeout: 2000,
            interCommandDelayMs: 20,
          },
        },
      ],
      serialConfig: { baudRate: 9600, rtscts: false },
      settingsSchema: {
        channelSchema: {},
        model: 'kenwood-th-f6',
        settingsSchema: {},
      },
      writeMemory: [
        {
          description: 'Write memories via live CAT',
          catWrite: {
            segment: 'channels',
            count: 400,
            recordSize: 32,
            pack: 'kenwood-th-f6',
            timeout: 2000,
            interCommandDelayMs: 20,
          },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});
