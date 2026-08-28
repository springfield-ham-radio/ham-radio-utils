import { describe, it } from 'node:test';
import { expect } from 'chai';
import {
  Frequency,
  type RadioMemoryConfig,
  type RadioMemoryMap,
  type RadioProgram,
  RadioToneType,
} from '@springfield/ham-radio-api';
import {
  decodeRadioProgram,
  encodeRadioProgram,
} from '../../src/memory/memory-map-channels.js';

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
      count: 4,
      stride: 16,
      emptyWhen: { equals: 0xff },
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
        { id: '_unused1', type: 'bits', width: 3, reserved: true },
        { id: 'isuhf', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: 'scode', type: 'bits', width: 4, value: { kind: 'integer', min: 0, max: 15 } },
        { id: '_unknown1', type: 'bits', width: 7, reserved: true },
        { id: '_txtoneicon', type: 'bits', width: 1, reserved: true },
        { id: '_mailicon', type: 'bits', width: 3, reserved: true },
        { id: '_unknown2', type: 'bits', width: 3, reserved: true },
        { id: 'lowpower', type: 'bits', width: 2, value: { kind: 'integer', min: 0, max: 3 } },
        { id: '_unknown3', type: 'bits', width: 1, reserved: true },
        { id: 'wide', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: '_unknown4', type: 'bits', width: 2, reserved: true },
        { id: 'bcl', type: 'bits', width: 1, value: { kind: 'boolean' } },
        { id: 'scan', type: 'bits', width: 1, value: { kind: 'boolean' } },
        {
          id: 'pttid',
          type: 'bits',
          width: 2,
          value: { kind: 'enum', values: ['Off', 'BOT', 'EOT', 'Both'] },
        },
      ],
    },
    {
      id: 'names',
      seek: '0x1000',
      count: 4,
      stride: 16,
      emptyWhen: { equals: 0xff },
      clearEmpty: true,
      fields: [{ id: 'name', type: 'u8', value: { kind: 'ascii', length: 7 } }],
    },
    {
      id: 'settings',
      seek: '0x0E20',
      fields: [{ id: 'squelch', type: 'u8', value: { kind: 'integer', min: 0, max: 9 } }],
    },
  ],
};

describe('decodeRadioProgram / encodeRadioProgram', () => {
  it('round-trips a channel into RadioChannel core plus settings extras', () => {
    const contents = new Uint8Array(8192).fill(0xff);
    contents[0x0e20] = 4;

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
          settings: {
            transmitPower: 5,
            mode: 'FM',
            skip: '',
            bcl: true,
            scode: 2,
            pttid: 'Off',
          },
        },
      ],
      settings: {
        settings: { squelch: 4 },
      },
    };

    encodeRadioProgram(channelMap, program, contents, memoryConfig);
    const decoded = decodeRadioProgram(channelMap, contents, memoryConfig);

    expect(decoded.channels).to.have.length(1);
    expect(decoded.channels[0].channelNumber).to.equal(0);

    const channel = decoded.channels[0].radioChannel;
    expect(typeof channel).to.equal('object');

    if (typeof channel === 'object') {
      expect(channel.name).to.equal('TEST');
      expect(channel.receiveFrequency).to.equal(146_520_000);
      expect(channel.transmitFrequency).to.equal(146_520_000);
      expect(channel.receiveTone).to.deep.equal({ tone: 885, type: RadioToneType.CTCSS });
      expect(channel.transmitTone).to.deep.equal({ tone: 23, type: RadioToneType.DCS });
    }

    expect(decoded.channels[0].settings?.transmitPower).to.equal(5);
    expect(decoded.channels[0].settings?.mode).to.equal('FM');
    expect(decoded.channels[0].settings?.skip).to.equal('');
    expect(decoded.channels[0].settings?.bcl).to.equal(true);
    expect((decoded.settings.settings as { squelch: number }).squelch).to.equal(4);
    expect(decoded.settings.channels).to.equal(undefined);
  });

  it('clears slots missing from the program when clearEmpty is set', () => {
    const contents = new Uint8Array(8192).fill(0xff);
    let word = Number.parseInt((146_520_000 / 10).toString(10), 16);
    for (let index = 0; index < 4; index += 1) {
      contents[16 + index] = word & 0xff;
      word >>= 8;
    }

    encodeRadioProgram(
      channelMap,
      { channels: [], settings: {} },
      contents,
      memoryConfig,
    );

    expect(contents[16]).to.equal(0xff);
  });
});

describe('Kenwood-style offset duplex and tone-mode bits', () => {
  const kenwoodTones = [670, 693, 719, 744, 770, 797, 825, 854, 885];
  const kenwoodMap: RadioMemoryMap = {
    channelBindings: {
      records: 'channels',
      nameField: 'name',
      receiveFrequency: 'freq',
      transmitFrequency: 'offset',
      receiveTone: 'ctone',
      transmitTone: 'rtone',
    },
    structs: [
      {
        id: 'channels',
        seek: 0,
        count: 2,
        stride: 32,
        emptyWhen: { equals: 0xff },
        clearEmpty: true,
        fields: [
          { id: 'freq', type: 'u32', value: { kind: 'integer' } },
          { id: 'offset', type: 'u32', value: { kind: 'integer' } },
          { id: 'duplex', type: 'u8', value: { kind: 'enum', values: ['', '+', '-'] } },
          { id: 'tone_mode', type: 'u8', value: { kind: 'boolean' } },
          { id: 'ctcss_mode', type: 'u8', value: { kind: 'boolean' } },
          { id: 'dtcs_mode', type: 'u8', value: { kind: 'boolean' } },
          { id: 'rtone', type: 'u8', value: { kind: 'ctcss-index', values: kenwoodTones } },
          { id: 'ctone', type: 'u8', value: { kind: 'ctcss-index', values: kenwoodTones } },
          { id: 'mode', type: 'u8', value: { kind: 'enum', values: ['FM', 'AM'] } },
          { id: 'name', type: 'u8', value: { kind: 'ascii', length: 8, pad: 0 } },
        ],
      },
    ],
  };

  const kenwoodMemory: RadioMemoryConfig = {
    chunkSize: 32,
    addressSize: 2,
    addressEndianness: 'big',
    segments: {
      image: { startAddress: 0, endAddress: 63 },
    },
  };

  it('round-trips simplex TX as RX and encode-tone CTCSS without an extras table', () => {
    const contents = new Uint8Array(64).fill(0xff);
    const program: RadioProgram = {
      channels: [
        {
          channelNumber: 0,
          radioChannel: {
            name: 'CALL',
            receiveFrequency: Frequency(146_520_000),
            transmitFrequency: Frequency(146_520_000),
            receiveTone: { tone: 0, type: RadioToneType.CTCSS },
            transmitTone: { tone: 885, type: RadioToneType.CTCSS },
          },
          settings: {
            mode: 'AM',
            duplex: '',
          },
        },
      ],
      settings: {},
    };

    encodeRadioProgram(kenwoodMap, program, contents, kenwoodMemory);
    const decoded = decodeRadioProgram(kenwoodMap, contents, kenwoodMemory);
    const channel = decoded.channels[0].radioChannel;

    expect(decoded.channels).to.have.length(1);

    if (typeof channel === 'object') {
      expect(channel.name).to.equal('CALL');
      expect(channel.receiveFrequency).to.equal(146_520_000);
      expect(channel.transmitFrequency).to.equal(146_520_000);
      expect(channel.transmitTone).to.deep.equal({ tone: 885, type: RadioToneType.CTCSS });
    }

    expect(decoded.channels[0].settings?.mode).to.equal('AM');
  });
});

describe('Kenwood TM-D710 chmap band extras', () => {
  const map: RadioMemoryMap = {
    channelBindings: {
      extras: 'flags',
      records: 'channels',
      nameField: 'name',
      receiveFrequency: 'freq',
      transmitFrequency: 'offset',
      receiveTone: 'ctone',
      transmitTone: 'rtone',
    },
    structs: [
      {
        id: 'flags',
        seek: 0,
        count: 2,
        stride: 2,
        emptyWhen: { equals: 255 },
        clearEmpty: true,
        fields: [
          { id: 'band', type: 'u8', value: { kind: 'integer', min: 0, max: 9 } },
          { id: 'lockout', type: 'u8', value: { kind: 'boolean' } },
        ],
      },
      {
        id: 'channels',
        seek: 4,
        count: 2,
        stride: 8,
        emptyWhen: { equals: 255 },
        clearEmpty: true,
        fields: [
          { id: 'freq', type: 'u32', value: { kind: 'integer' } },
          { id: 'offset', type: 'u32', value: { kind: 'integer' } },
        ],
      },
    ],
  };

  const memory: RadioMemoryConfig = {
    chunkSize: 8,
    addressSize: 2,
    addressEndianness: 'big',
    segments: {
      image: { startAddress: 0, endAddress: 19 },
    },
  };

  it('writes 2m memories as chmap band 5', () => {
    const contents = new Uint8Array(20).fill(0xff);
    const program: RadioProgram = {
      channels: [
        {
          channelNumber: 0,
          radioChannel: {
            name: '',
            receiveFrequency: Frequency(146_520_000),
            transmitFrequency: Frequency(146_520_000),
            receiveTone: { tone: 0, type: RadioToneType.CTCSS },
            transmitTone: { tone: 0, type: RadioToneType.CTCSS },
          },
        },
      ],
      settings: {},
    };

    encodeRadioProgram(map, program, contents, memory);

    expect(contents[0]).to.equal(5);
    expect(contents[1]).to.equal(0);
  });
});
