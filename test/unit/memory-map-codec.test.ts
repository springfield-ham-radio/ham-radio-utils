import { describe, it } from 'node:test';
import { expect } from 'chai';
import type { RadioMemoryConfig, RadioMemoryMap } from '@springfield/ham-radio-api';
import {
  decodeMemoryMap,
  encodeMemoryMap,
  parseSeekAddress,
  radioAddressToBufferOffset,
} from '../../src/memory/memory-map-codec.js';

const uv5rMemoryConfig: RadioMemoryConfig = {
  chunkSize: 64,
  addressSize: 2,
  addressEndianness: 'big',
  segments: {
    channels: { startAddress: 0, endAddress: 6143 },
    settings: { startAddress: 7872, endAddress: 8191 },
  },
};

describe('parseSeekAddress', () => {
  it('parses hex strings and numbers', () => {
    expect(parseSeekAddress('0x0E20')).to.equal(0x0e20);
    expect(parseSeekAddress(0x0e20)).to.equal(0x0e20);
    expect(parseSeekAddress('3616')).to.equal(3616);
  });
});

describe('radioAddressToBufferOffset', () => {
  it('maps main-block addresses 1:1 in a packed buffer', () => {
    const packedSize = 6144 + 320;
    expect(radioAddressToBufferOffset(0x0e20, uv5rMemoryConfig, packedSize)).to.equal(0x0e20);
  });

  it('maps aux addresses into the packed tail', () => {
    const packedSize = 6144 + 320;
    // radio 0x1EE0 → segment settings starts 0x1EC0 → packed offset 6144 + 0x20
    expect(radioAddressToBufferOffset(0x1ee0, uv5rMemoryConfig, packedSize)).to.equal(6144 + 0x20);
  });

  it('uses absolute addressing for a sparse full-size image', () => {
    expect(radioAddressToBufferOffset(0x1ee0, uv5rMemoryConfig, 8192)).to.equal(0x1ee0);
  });
});

describe('decodeMemoryMap / encodeMemoryMap', () => {
  const basicMap: RadioMemoryMap = {
    structs: [
      {
        id: 'settings',
        seek: '0x0E20',
        fields: [
          {
            id: 'squelch',
            type: 'u8',
            value: { kind: 'integer', min: 0, max: 9 },
            ui: { group: 'basic', label: 'Carrier Squelch Level', widget: 'integer' },
          },
          { id: '_pad1', type: 'u8', reserved: true },
          {
            id: 'save',
            type: 'u8',
            value: { kind: 'enum', values: ['Off', '1:1', '1:2', '1:3', '1:4'] },
            ui: { group: 'basic', label: 'Battery Saver', widget: 'select' },
          },
          {
            id: 'tdr',
            type: 'u8',
            value: { kind: 'boolean' },
            ui: { group: 'advanced', label: 'Dual Watch', widget: 'switch' },
          },
        ],
      },
    ],
  };

  it('decodes integer, enum, and boolean fields at radio 0x0E20', () => {
    const contents = new Uint8Array(8192);
    contents[0x0e20] = 3;
    contents[0x0e21] = 0xff;
    contents[0x0e22] = 2; // 1:2
    contents[0x0e23] = 1; // true

    const settings = decodeMemoryMap(basicMap, contents, uv5rMemoryConfig);

    expect(settings.settings).to.deep.equal({
      squelch: 3,
      save: '1:2',
      tdr: true,
    });
  });

  it('encodes settings back into the same offsets without wiping other bytes', () => {
    const contents = new Uint8Array(8192);
    contents[0x0e20] = 1;
    contents[0x0e21] = 0xaa;
    contents[0x0e22] = 0;
    contents[0x0e23] = 0;
    contents[0x1000] = 0x42;

    encodeMemoryMap(
      basicMap,
      { settings: { squelch: 5, save: '1:4', tdr: true } },
      contents,
      uv5rMemoryConfig,
    );

    expect(contents[0x0e20]).to.equal(5);
    expect(contents[0x0e21]).to.equal(0xaa);
    expect(contents[0x0e22]).to.equal(4);
    expect(contents[0x0e23]).to.equal(1);
    expect(contents[0x1000]).to.equal(0x42);
  });

  it('decodes MSB-first bitfields within a byte (Chirp style)', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'wmchannel',
          seek: '0x0E76',
          fields: [
            { id: '_unused1', type: 'bits', width: 1, reserved: true },
            {
              id: 'mrcha',
              type: 'bits',
              width: 7,
              value: { kind: 'integer', min: 0, max: 127 },
              ui: { group: 'workmode', label: 'MR A Channel', widget: 'integer' },
            },
            { id: '_unused2', type: 'bits', width: 1, reserved: true },
            {
              id: 'mrchb',
              type: 'bits',
              width: 7,
              value: { kind: 'integer', min: 0, max: 127 },
              ui: { group: 'workmode', label: 'MR B Channel', widget: 'integer' },
            },
          ],
        },
      ],
    };

    const contents = new Uint8Array(8192);
    // unused=0, mrcha=42 → 0b0_0101010 = 0x2A
    contents[0x0e76] = 0x2a;
    // unused=0, mrchb=7 → 0b0_0000111 = 0x07
    contents[0x0e77] = 0x07;

    const settings = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect(settings.wmchannel).to.deep.equal({ mrcha: 42, mrchb: 7 });
  });

  it('decodes ASCII and digit arrays', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'poweron_msg',
          seek: '0x1EE0',
          fields: [
            {
              id: 'line1',
              type: 'u8',
              value: { kind: 'ascii', length: 7 },
              ui: { group: 'other', label: 'Power-On Message 1', widget: 'text', writable: true },
            },
          ],
        },
        {
          id: 'vfoa',
          seek: '0x0F08',
          fields: [
            {
              id: 'freq',
              type: 'u8',
              value: { kind: 'digits', length: 8, scale: 10 },
              ui: { group: 'workmode', label: 'VFO A Frequency', widget: 'number' },
            },
          ],
        },
      ],
    };

    const contents = new Uint8Array(8192);
    const line = 'BAOFENG';
    for (let index = 0; index < line.length; index += 1) {
      contents[0x1ee0 + index] = line.charCodeAt(index);
    }

    // 146.52000 MHz → 14652000 / 10 = 1465200 → digits 01465200
    const digits = [0, 1, 4, 6, 5, 2, 0, 0];
    for (let index = 0; index < 8; index += 1) {
      contents[0x0f08 + index] = digits[index];
    }

    const settings = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect((settings.poweron_msg as { line1: string }).line1).to.equal('BAOFENG');
    expect((settings.vfoa as { freq: number }).freq).to.equal(14_652_000);
  });

  it('decodes repeated structs with stride (PTT-ID codes)', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'pttid',
          seek: '0x0B00',
          count: 2,
          stride: 16,
          fields: [
            {
              id: 'code',
              type: 'u8',
              value: { kind: 'dtmf', length: 5, charset: '0123456789 *#ABCD' },
              ui: { group: 'dtmf', label: 'PTT ID Code', widget: 'text' },
            },
          ],
        },
      ],
    };

    const contents = new Uint8Array(8192);
    // code "12" → indices 1, 2, then 0xFF
    contents[0x0b00] = 1;
    contents[0x0b01] = 2;
    contents[0x0b02] = 0xff;
    contents[0x0b10] = 3;
    contents[0x0b11] = 0xff;

    const settings = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect(settings.pttid).to.deep.equal([{ code: '12' }, { code: '3' }]);
  });

  it('decodes from a packed driver buffer for aux addresses', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'firmware_msg',
          seek: '0x1EF0',
          fields: [
            {
              id: 'line1',
              type: 'u8',
              value: { kind: 'ascii', length: 7 },
              ui: {
                group: 'other',
                label: 'Firmware Message 1',
                widget: 'text',
                writable: false,
              },
            },
          ],
        },
      ],
    };

    const packed = new Uint8Array(6144 + 320);
    const packedOffset = 6144 + (0x1ef0 - 7872);
    const text = 'BFB291';
    for (let index = 0; index < text.length; index += 1) {
      packed[packedOffset + index] = text.charCodeAt(index);
    }

    const settings = decodeMemoryMap(map, packed, uv5rMemoryConfig);
    expect((settings.firmware_msg as { line1: string }).line1).to.equal('BFB291');
  });

  it('round-trips encode then decode for mixed field types', () => {
    const contents = new Uint8Array(8192).fill(0xff);
    const settings = {
      settings: { squelch: 7, save: '1:1', tdr: false },
    };

    encodeMemoryMap(basicMap, settings, contents, uv5rMemoryConfig);
    const decoded = decodeMemoryMap(basicMap, contents, uv5rMemoryConfig);
    expect(decoded.settings).to.deep.equal(settings.settings);
  });

  it('decodes and encodes Chirp lbcd frequencies', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'channels',
          seek: 0,
          count: 2,
          stride: 16,
          fields: [
            { id: 'rxfreq', type: 'u8', value: { kind: 'lbcd', length: 4, scale: 10 } },
            { id: 'txfreq', type: 'u8', value: { kind: 'lbcd', length: 4, scale: 10 } },
          ],
        },
      ],
    };

    const contents = new Uint8Array(8192).fill(0xff);
    // 146520000 Hz → 14652000 → hex as decimal digits packed LE
    const hz = 146_520_000;
    let word = Number.parseInt((hz / 10).toString(10), 16);
    for (let index = 0; index < 4; index += 1) {
      contents[index] = word & 0xff;
      word >>= 8;
    }
    for (let index = 0; index < 4; index += 1) {
      contents[4 + index] = contents[index];
    }

    const decoded = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect((decoded.channels as { rxfreq: number }[])[0].rxfreq).to.equal(hz);

    encodeMemoryMap(map, { channels: [{ rxfreq: hz, txfreq: hz }, null] }, contents, uv5rMemoryConfig);
    const again = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect((again.channels as { rxfreq: number; txfreq: number }[])[0]).to.deep.equal({
      rxfreq: hz,
      txfreq: hz,
    });
  });

  it('decodes Chirp-style tone words (CTCSS and DCS)', () => {
    const dcsValues = [23, 25, 26, 31];
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'channels',
          seek: 0,
          count: 2,
          stride: 16,
          fields: [
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
          ],
        },
      ],
    };

    const contents = new Uint8Array(8192).fill(0xff);
    // CTCSS 88.5 → 885
    contents[0] = 885 & 0xff;
    contents[1] = (885 >> 8) & 0xff;
    // DCS 23 index 0 → raw 1
    contents[2] = 1;
    contents[3] = 0;

    const decoded = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    const channel = (decoded.channels as Record<string, unknown>[])[0];
    expect(channel.rxtone).to.deep.equal({ mode: 'ctcss', value: 885 });
    expect(channel.txtone).to.deep.equal({ mode: 'dcs', code: 23, polarity: 'N' });
  });

  it('skips empty slots via emptyWhen and clears them when clearEmpty is set', () => {
    const map: RadioMemoryMap = {
      structs: [
        {
          id: 'channels',
          seek: 0,
          count: 2,
          stride: 16,
          emptyWhen: { equals: 0xff },
          clearEmpty: true,
          fields: [{ id: 'rxfreq', type: 'u8', value: { kind: 'lbcd', length: 4, scale: 10 } }],
        },
      ],
    };

    const contents = new Uint8Array(8192).fill(0xff);
    let word = Number.parseInt((146_520_000 / 10).toString(10), 16);
    for (let index = 0; index < 4; index += 1) {
      contents[index] = word & 0xff;
      word >>= 8;
    }

    const decoded = decodeMemoryMap(map, contents, uv5rMemoryConfig);
    expect(decoded.channels).to.deep.equal([
      { rxfreq: 146_520_000 },
      null,
    ]);

    contents[16] = 0x12;
    encodeMemoryMap(map, { channels: [{ rxfreq: 146_520_000 }, null] }, contents, uv5rMemoryConfig);
    expect(contents[16]).to.equal(0xff);
  });
});
