import type { RadioMemoryMap } from '@springfield/ham-radio-api';

function structRecordCount(memoryMap: RadioMemoryMap, structId: string): number | undefined {
  const struct = memoryMap.structs.find((entry) => entry.id === structId);
  if (!struct) {
    return undefined;
  }

  return struct.count ?? 1;
}

/**
 * Total channel record slots in the bound records struct (regular + special).
 */
export function memoryMapChannelRecordCount(memoryMap: RadioMemoryMap): number | undefined {
  const bindings = memoryMap.channelBindings;
  if (!bindings) {
    return undefined;
  }

  return structRecordCount(memoryMap, bindings.records);
}

/**
 * Number of regular (non-special) channel slots. When `specials` is absent, this
 * equals {@link memoryMapChannelRecordCount}.
 */
export function memoryMapRegularChannelCapacity(memoryMap: RadioMemoryMap): number | undefined {
  const total = memoryMapChannelRecordCount(memoryMap);
  if (total === undefined) {
    return undefined;
  }

  const start = memoryMap.channelBindings?.specials?.start;
  return start ?? total;
}

/**
 * Human label for a special channel index, or undefined when the index is not special
 * or specials metadata is absent.
 */
export function memoryMapSpecialChannelLabel(memoryMap: RadioMemoryMap, index: number): string | undefined {
  const specials = memoryMap.channelBindings?.specials;
  if (!specials || index < specials.start) {
    return undefined;
  }

  const offset = index - specials.start;
  if (offset >= specials.labels.length) {
    return undefined;
  }

  return specials.labels[offset];
}

export function isSpecialChannelIndex(memoryMap: RadioMemoryMap, index: number): boolean {
  return memoryMapSpecialChannelLabel(memoryMap, index) !== undefined;
}

function expectedChannelSlotCount(memoryMap: RadioMemoryMap): number | undefined {
  const bindings = memoryMap.channelBindings;
  if (!bindings?.specials) {
    return undefined;
  }

  return bindings.specials.start + bindings.specials.labels.length;
}

/**
 * Semantic checks for `channelBindings.specials` alignment with struct counts.
 */
export function memoryMapSpecialsConsistencyErrors(memoryMap: unknown): string[] {
  if (!isRadioMemoryMap(memoryMap)) {
    return [];
  }

  const bindings = memoryMap.channelBindings;
  if (!bindings?.specials) {
    return [];
  }

  const expected = expectedChannelSlotCount(memoryMap);
  const errors: string[] = [];

  const recordsCount = structRecordCount(memoryMap, bindings.records);
  if (recordsCount === undefined) {
    errors.push(`/channelBindings/records: struct "${bindings.records}" not found`);
  } else if (expected !== undefined && recordsCount !== expected) {
    errors.push(
      `/channelBindings/specials: records struct count (${recordsCount}) must equal start (${bindings.specials.start}) + labels.length (${bindings.specials.labels.length})`,
    );
  }

  if (bindings.names) {
    const namesCount = structRecordCount(memoryMap, bindings.names);
    if (namesCount === undefined) {
      errors.push(`/channelBindings/names: struct "${bindings.names}" not found`);
    } else if (recordsCount !== undefined && namesCount !== recordsCount) {
      errors.push(
        `/channelBindings/names: struct count (${namesCount}) must match records struct count (${recordsCount}) when specials are declared`,
      );
    }
  }

  if (bindings.extras) {
    const extrasCount = structRecordCount(memoryMap, bindings.extras);
    if (extrasCount === undefined) {
      errors.push(`/channelBindings/extras: struct "${bindings.extras}" not found`);
    } else if (recordsCount !== undefined && extrasCount !== recordsCount) {
      errors.push(
        `/channelBindings/extras: struct count (${extrasCount}) must match records struct count (${recordsCount}) when specials are declared`,
      );
    }
  }

  return errors;
}

function isRadioMemoryMap(value: unknown): value is RadioMemoryMap {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as RadioMemoryMap).structs);
}