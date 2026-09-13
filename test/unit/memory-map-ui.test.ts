import { describe, it } from 'node:test';
import { expect } from 'chai';
import type { RadioMemoryMap } from '@springfield/ham-radio-api';
import {
  collectChannelMemoryMapUiFields,
  collectMemoryMapUiFields,
  collectMemoryMapUiGroups,
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
          ui: { group: 'basic', label: 'Squelch', widget: 'integer', subgroup: 'receive' },
        },
        {
          id: 'timeout',
          type: 'u8',
          value: { kind: 'integer', min: 0, max: 10 },
          ui: { group: 'basic', label: 'Timeout', widget: 'integer', subgroup: 'timer' },
        },
        {
          id: 'calibration',
          type: 'u8',
          value: { kind: 'integer', min: 0, max: 255 },
          ui: { group: 'service', label: 'Calibration', widget: 'integer' },
        },
      ],
    },
  ],
};

describe('collectMemoryMapUiFields', () => {
  it('skips channel-bound structs', () => {
    const fields = collectMemoryMapUiFields(sampleMap);
    expect(fields.map((field) => field.fieldId)).to.deep.equal(['squelch', 'timeout', 'calibration']);
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

describe('collectMemoryMapUiGroups', () => {
  it('uses declared group metadata and order, skipping empty groups', () => {
    const grouped = collectMemoryMapUiGroups({
      ...sampleMap,
      groups: [
        {
          id: 'service',
          label: 'Service Settings',
          icon: 'i-lucide-wrench',
          warning: {
            title: 'Service calibration values',
            description: 'Change only with appropriate test equipment.',
          },
        },
        { id: 'basic', label: 'Basic Settings', icon: 'i-lucide-sliders-horizontal' },
        { id: 'empty', label: 'Unused' },
      ],
    });

    expect(grouped.map((group) => group.id)).to.deep.equal(['service', 'basic']);
    expect(grouped[0]?.label).to.equal('Service Settings');
    expect(grouped[0]?.icon).to.equal('i-lucide-wrench');
    expect(grouped[0]?.warning?.title).to.equal('Service calibration values');
    expect(grouped[0]?.fields.map((field) => field.fieldId)).to.deep.equal(['calibration']);
    expect(grouped[0]?.groups).to.deep.equal([]);
    expect(grouped[1]?.fields.map((field) => field.fieldId)).to.deep.equal(['squelch', 'timeout']);
    expect(grouped[1]?.groups.map((subgroup) => subgroup.id)).to.deep.equal(['receive', 'timer']);
  });

  it('title-cases undeclared group ids when no groups are declared', () => {
    const grouped = collectMemoryMapUiGroups(sampleMap);
    expect(grouped.map((group) => ({ id: group.id, label: group.label }))).to.deep.equal([
      { id: 'basic', label: 'Basic' },
      { id: 'service', label: 'Service' },
    ]);
  });

  it('uses declared sub-groups as panel sections and title-cases undeclared ones', () => {
    const grouped = collectMemoryMapUiGroups({
      ...sampleMap,
      groups: [
        {
          id: 'basic',
          label: 'Basic Settings',
          groups: [{ id: 'timer', label: 'Timers' }],
        },
      ],
    });

    expect(grouped).to.have.length(2);
    expect(grouped[0]?.groups.map((subgroup) => ({ id: subgroup.id, label: subgroup.label }))).to.deep.equal([
      { id: 'timer', label: 'Timers' },
      { id: 'receive', label: 'Receive' },
    ]);
    expect(grouped[0]?.groups[0]?.fields.map((field) => field.fieldId)).to.deep.equal(['timeout']);
    expect(grouped[0]?.groups[1]?.fields.map((field) => field.fieldId)).to.deep.equal(['squelch']);
  });

  it('sorts section fields by ui.order without changing declaration order as the default', () => {
    const grouped = collectMemoryMapUiGroups({
      version: '1.0.0',
      structs: [
        {
          id: 'settings',
          seek: 0,
          fields: [
            {
              id: 'vhf_enable',
              type: 'u8',
              value: { kind: 'boolean' },
              ui: { group: 'other', label: 'VHF TX Enabled', widget: 'switch', subgroup: 'limits', order: 1 },
            },
            {
              id: 'vhf_lower',
              type: 'u8',
              value: { kind: 'integer' },
              ui: { group: 'other', label: 'VHF Lower', widget: 'integer', subgroup: 'limits', order: 3 },
            },
            {
              id: 'uhf_enable',
              type: 'u8',
              value: { kind: 'boolean' },
              ui: { group: 'other', label: 'UHF TX Enabled', widget: 'switch', subgroup: 'limits', order: 2 },
            },
          ],
        },
      ],
      groups: [{ id: 'other', label: 'Other Settings', groups: [{ id: 'limits', label: 'Band Limits' }] }],
    } as RadioMemoryMap);

    expect(grouped[0]?.groups[0]?.fields.map((field) => field.fieldId)).to.deep.equal([
      'vhf_enable',
      'uhf_enable',
      'vhf_lower',
    ]);
  });
});
