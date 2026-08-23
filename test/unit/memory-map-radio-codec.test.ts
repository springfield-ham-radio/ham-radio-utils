import { describe, it } from 'node:test';
import { expect } from 'chai';
import {
  Frequency,
  type RadioMemoryConfig,
  type RadioMemoryMap,
  type RadioProgram,
  RadioToneType,
} from '@springfield/ham-radio-api';
import { MockLogLayer } from 'loglayer';
import {
  createEmptyMemoryImage,
  createMemoryMapCodec,
  memoryImageSize,
} from '../../src/memory/memory-map-radio-codec.js';

const memoryConfig: RadioMemoryConfig = {
  chunkSize: 64,
  addressSize: 2,
  addressEndianness: 'big',
  segments: {
    channels: { startAddress: 0, endAddress: 6143 },
    settings: { startAddress: 7872, endAddress: 8191 },
  },
};

const dcsValues = [23, 25, 26, 31];

const channelMap: RadioMemoryMap = {
  channelBindings: {
    records: 'channels',
    names: 'names',
    nameField: 'name',
    receiveFrequency: 'rxfreq',
    transmitFrequency: 'txfreq',
    receiveTone: 'rxtone',
    transmitTone: 'txtone',
  },
  structs: [
    {
      id: 'channels',
      seek: 0,
      count: 128,
      stride: 16,
      emptyWhen: { equals: 255 },
      clearEmpty: true,
      fields: [
        { id: 'rxfreq', type: 'u8', value: { kind: 'lbcd', length: 4, scale: 10 } },
        { id: 'txfreq', type: 'u8', value: { kind: 'lbcd', length: 4, scale: 10 } },
        {
          id: 'rxtone',
          type: 'u16',
          value: { kind: 'tone', values: dcsValues, ctcssMin: 0x0258, reverseOffset: 0x69 },
        },
        {
          id: 'txtone',
          type: 'u16',
          value: { kind: 'tone', values: dcsValues, ctcssMin: 0x0258, reverseOffset: 0x69 },
        },
        { id: 'unused', type: 'u8', reserved: true },
        { id: 'power', type: 'bits', width: 2, value: { kind: 'enum', values: ['', '', '', 'High'] } },
        { id: 'wide', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: 'skip', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: 'bcl', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: 'unused2', type: 'bits', width: 3, reserved: true },
      ],
    },
    {
      id: 'names',
      seek: 0x1000,
      count: 128,
      stride: 16,
      fields: [{ id: 'name', type: 'u8', value: { kind: 'ascii', length: 7 } }],
    },
  ],
};

describe('MemoryMapRadioCodec', () => {
  it('reports sparse image size from memoryConfig segments', () => {
    expect(memoryImageSize(memoryConfig)).to.equal(8192);
    expect(createEmptyMemoryImage(4)).to.deep.equal(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });

  it('round-trips a program through RadioCodec encode/decode', () => {
    const codec = createMemoryMapCodec({
      radioModel: 'test-radio' as never,
      memoryMap: channelMap,
      memoryConfig,
      logger: new MockLogLayer(),
    });

    const program: RadioProgram = {
      channels: [
        {
          channelNumber: 0,
          radioChannel: {
            name: 'TEST',
            receiveFrequency: Frequency(146_520_000),
            transmitFrequency: Frequency(146_520_000),
            receiveTone: { tone: 885, type: RadioToneType.CTCSS },
            transmitTone: { tone: 23, type: RadioToneType.DCS },
          },
          settings: {},
        },
      ],
      settings: {},
    };

    const encoded = codec.encode(program, {
      contents: createEmptyMemoryImage(memoryImageSize(memoryConfig)),
      radioModel: 'test-radio' as never,
    });
    const decoded = codec.decode(encoded);

    expect(decoded.channels).to.have.length(1);
    expect(decoded.channels[0].channelNumber).to.equal(0);

    const channel = decoded.channels[0].radioChannel;

    if (typeof channel === 'object') {
      expect(channel.name).to.equal('TEST');
      expect(channel.receiveFrequency).to.equal(146_520_000);
    }
  });
});
