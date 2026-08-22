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
