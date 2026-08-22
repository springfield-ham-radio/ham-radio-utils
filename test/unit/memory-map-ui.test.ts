import { describe, it } from 'node:test';
import { expect } from 'chai';
import type { RadioMemoryMap } from '@springfield/ham-radio-api';
import {
  collectChannelMemoryMapUiFields,
  collectMemoryMapUiFields,
  formatMemoryMapFieldValue,
} from '../../src/memory/memory-map-ui.js';

const sampleMap: RadioMemoryMap = {
  version: '1.0.0',
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
      count: 2,
      stride: 16,
      fields: [
        {
          id: 'rxfreq',
          type: 'u8',
          value: { kind: 'lbcd', length: 4 },
        },
        {
          id: 'lowpower',
          type: 'bits',
          width: 2,
          value: { kind: 'integer', min: 0, max: 3 },
          ui: { group: 'channel', label: 'Power', widget: 'select' },
        },
        {
          id: 'wide',
          type: 'bits',
          width: 1,
          value: { kind: 'boolean' },
          ui: { group: 'channel', label: 'Mode', widget: 'switch' },
        },
        {
          id: 'scode',
          type: 'bits',
          width: 4,
          value: { kind: 'integer', min: 0, max: 15 },
          ui: { group: 'channel', label: 'PTT ID', widget: 'integer' },
        },
      ],
    },
    {
      id: 'names',
      seek: '0x1000',
      count: 2,
      stride: 16,
      fields: [{ id: 'name', type: 'u8', value: { kind: 'ascii', length: 7 } }],
    },
    {
      id: 'settings',
      seek: '0x0E20',
      fields: [
        {
          id: 'squelch',
          type: 'u8',
          value: { kind: 'integer', min: 0, max: 9 },
          ui: { group: 'basic', label: 'Squelch', widget: 'integer' },
        },
      ],
    },
  ],
};

describe('collectMemoryMapUiFields', () => {
  it('skips channel-bound structs', () => {
    const fields = collectMemoryMapUiFields(sampleMap);
    expect(fields.map((field) => field.fieldId)).to.deep.equal(['squelch']);
  });
});

describe('collectChannelMemoryMapUiFields', () => {
  it('returns channel settings fields with ui, not RadioChannel-bound fields', () => {
    const fields = collectChannelMemoryMapUiFields(sampleMap);
    expect(fields.map((field) => field.fieldId)).to.deep.equal(['lowpower', 'wide', 'scode']);
    expect(fields[0]?.ui.label).to.equal('Power');
  });
});

describe('formatMemoryMapFieldValue', () => {
  it('formats power, mode, and scode for display', () => {
    const [power, mode, scode] = collectChannelMemoryMapUiFields(sampleMap);

    expect(formatMemoryMapFieldValue(0, power!)).to.equal('High');
    expect(formatMemoryMapFieldValue(1, power!)).to.equal('Low');
    expect(formatMemoryMapFieldValue(true, mode!)).to.equal('Wide');
    expect(formatMemoryMapFieldValue(false, mode!)).to.equal('Narrow');
    expect(formatMemoryMapFieldValue(0, scode!)).to.equal('1');
    expect(formatMemoryMapFieldValue(15, scode!)).to.equal('16');
  });
});
