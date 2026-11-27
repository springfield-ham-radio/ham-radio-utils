import { describe, expect, it } from 'vitest';
import type { RadioMemoryMap } from '@springfield/ham-radio-api';
import {
  isSpecialChannelIndex,
  memoryMapChannelRecordCount,
  memoryMapRegularChannelCapacity,
  memoryMapSpecialChannelLabel,
  memoryMapSpecialsConsistencyErrors,
} from '../../src/memory/memory-map-specials.js';
import { SchemaValidator } from '../../src/utils/schema-validator.js';

function baseMap(overrides?: Partial<RadioMemoryMap>): RadioMemoryMap {
  return {
    structs: [
      {
        id: 'channels',
        seek: 0,
        count: 4,
        fields: [{ id: 'rxfreq', type: 'u8' }],
      },
    ],
    channelBindings: {
      records: 'channels',
      receiveFrequency: 'rxfreq',
      transmitFrequency: 'txfreq',
      receiveTone: 'rxtone',
      transmitTone: 'txtone',
    },
    ...overrides,
  };
}

describe('memory-map specials helpers', () => {
  it('treats every record as regular when specials is absent', () => {
    const map = baseMap();

    expect(memoryMapChannelRecordCount(map)).toBe(4);
    expect(memoryMapRegularChannelCapacity(map)).toBe(4);
    expect(isSpecialChannelIndex(map, 0)).toBe(false);
    expect(isSpecialChannelIndex(map, 3)).toBe(false);
    expect(memoryMapSpecialChannelLabel(map, 0)).toBeUndefined();
  });

  it('reports regular capacity as specials.start and labels special indices', () => {
    const map = baseMap({
      structs: [
        {
          id: 'channels',
          seek: 0,
          count: 1007,
          fields: [{ id: 'rxfreq', type: 'u8' }],
        },
      ],
      channelBindings: {
        records: 'channels',
        receiveFrequency: 'rxfreq',
        transmitFrequency: 'txfreq',
        receiveTone: 'rxtone',
        transmitTone: 'txtone',
        specials: {
          start: 1000,
          labels: ['L0', 'L1', 'L2', 'U47', 'U48', 'U49', 'Pri'],
        },
      },
    });

    expect(memoryMapChannelRecordCount(map)).toBe(1007);
    expect(memoryMapRegularChannelCapacity(map)).toBe(1000);
    expect(isSpecialChannelIndex(map, 999)).toBe(false);
    expect(isSpecialChannelIndex(map, 1000)).toBe(true);
    expect(memoryMapSpecialChannelLabel(map, 1000)).toBe('L0');
    expect(memoryMapSpecialChannelLabel(map, 1006)).toBe('Pri');
    expect(memoryMapSpecialChannelLabel(map, 1007)).toBeUndefined();
  });
});

describe('memory-map specials semantic validation', () => {
  const validator = new SchemaValidator();

  function mapWithSpecials(recordsCount: number, namesCount?: number, extrasCount?: number) {
    const structs = [
      {
        id: 'channels',
        seek: 0,
        count: recordsCount,
        fields: [{ id: 'rxfreq', type: 'u8' }],
      },
    ];

    if (namesCount !== undefined) {
      structs.push({
        id: 'names',
        seek: '0x1000',
        count: namesCount,
        fields: [{ id: 'name', type: 'char' }],
      });
    }

    if (extrasCount !== undefined) {
      structs.push({
        id: 'flags',
        seek: '0x2000',
        count: extrasCount,
        fields: [{ id: 'scan', type: 'u8' }],
      });
    }

    return {
      structs,
      channelBindings: {
        records: 'channels',
        receiveFrequency: 'rxfreq',
        transmitFrequency: 'txfreq',
        receiveTone: 'rxtone',
        transmitTone: 'txtone',
        ...(namesCount !== undefined ? { names: 'names', nameField: 'name' } : {}),
        ...(extrasCount !== undefined ? { extras: 'flags' } : {}),
        specials: {
          start: 1000,
          labels: ['L0', 'Pri'],
        },
      },
    };
  }

  it('accepts aligned records, names, and extras counts', () => {
    const result = validator.validateMemoryMap(mapWithSpecials(1002, 1002, 1002));

    expect(result.valid, result.errors?.join('; ')).toBe(true);
  });

  it('rejects records count that does not match start + labels.length', () => {
    const result = validator.validateMemoryMap(mapWithSpecials(1000));

    expect(result.valid).toBe(false);
    expect(result.errors!.some((error) => error.includes('records struct count'))).toBe(true);
  });

  it('rejects mismatched names count via SchemaValidator', () => {
    const result = validator.validateMemoryMap(mapWithSpecials(1002, 1000));

    expect(result.valid).toBe(false);
    expect(result.errors!.some((error) => error.includes('/channelBindings/names'))).toBe(true);
  });

  it('rejects mismatched extras count via SchemaValidator', () => {
    const result = validator.validateMemoryMap(mapWithSpecials(1002, undefined, 999));

    expect(result.valid).toBe(false);
    expect(result.errors!.some((error) => error.includes('/channelBindings/extras'))).toBe(true);
  });

  it('rejects an empty special label in JSON schema validation', () => {
    const result = validator.validateMemoryMap({
      ...baseMap(),
      channelBindings: {
        ...baseMap().channelBindings!,
        specials: { start: 3, labels: ['ok', ''] },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors!.some((error) => error.includes('labels'))).toBe(true);
  });

  it('returns no consistency errors when specials is absent', () => {
    expect(memoryMapSpecialsConsistencyErrors(baseMap())).toEqual([]);
  });
});