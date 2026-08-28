import type {
  RadioMemoryMap,
  RadioMemoryMapFieldUi,
  RadioMemoryMapValueKind,
  RadioSettingValue,
} from '@springfield/ham-radio-api';

/**
 * Flattened field descriptor for schema-driven settings UI.
 */
export interface RadioMemoryMapUiField {
  /** Dot path into decoded settings, e.g. settings.squelch or pttid.0.code */
  path: string;
  structId: string;
  fieldId: string;
  arrayIndex?: number;
  ui: RadioMemoryMapFieldUi;
  value?: RadioMemoryMapValueKind;
}

function channelBoundFieldIds(memoryMap: RadioMemoryMap): Set<string> {
  const bindings = memoryMap.channelBindings;
  const ids = new Set<string>();

  if (!bindings) {
    return ids;
  }

  for (const key of [
    bindings.receiveFrequency,
    bindings.transmitFrequency,
    bindings.receiveTone,
    bindings.transmitTone,
    bindings.nameField,
  ]) {
    if (key) {
      ids.add(key);
    }
  }

  return ids;
}

/**
 * Collect writable UI fields from a memory map, in declaration order.
 * Channel-bound structs are skipped (use {@link collectChannelMemoryMapUiFields}).
 */
export function collectMemoryMapUiFields(memoryMap: RadioMemoryMap): RadioMemoryMapUiField[] {
  const fields: RadioMemoryMapUiField[] = [];
  const channelStructIds = new Set<string>();

  if (memoryMap.channelBindings) {
    channelStructIds.add(memoryMap.channelBindings.records);

    if (memoryMap.channelBindings.names) {
      channelStructIds.add(memoryMap.channelBindings.names);
    }

    if (memoryMap.channelBindings.extras) {
      channelStructIds.add(memoryMap.channelBindings.extras);
    }
  }

  for (const struct of memoryMap.structs) {
    if (channelStructIds.has(struct.id)) {
      continue;
    }

    const count = struct.count ?? 1;

    for (let index = 0; index < count; index += 1) {
      for (const field of struct.fields) {
        if (field.reserved || !field.ui) {
          continue;
        }

        const path =
          count > 1 ? `${struct.id}.${index}.${field.id}` : `${struct.id}.${field.id}`;

        const label =
          count > 1 && field.ui.label.indexOf('%') === -1
            ? `${field.ui.label} ${index + 1}`
            : field.ui.label;

        fields.push({
          path,
          structId: struct.id,
          fieldId: field.id,
          arrayIndex: count > 1 ? index : undefined,
          ui: { ...field.ui, label },
          value: field.value,
        });
      }
    }
  }

  return fields;
}

/**
 * Collect per-channel UI fields from the `channelBindings.records` struct.
 * Skips reserved fields, fields without `ui`, and fields bound onto RadioChannel.
 */
export function collectChannelMemoryMapUiFields(memoryMap: RadioMemoryMap): RadioMemoryMapUiField[] {
  const bindings = memoryMap.channelBindings;

  if (!bindings) {
    return [];
  }

  const struct = memoryMap.structs.find((entry) => entry.id === bindings.records);
  const extrasStruct = bindings.extras ? memoryMap.structs.find((entry) => entry.id === bindings.extras) : undefined;

  if (!struct) {
    return [];
  }

  const boundIds = channelBoundFieldIds(memoryMap);
  const fields: RadioMemoryMapUiField[] = [];

  for (const source of [struct, extrasStruct]) {
    if (!source) {
      continue;
    }

    for (const field of source.fields) {
      if (field.reserved || !field.ui || boundIds.has(field.id)) {
        continue;
      }

      fields.push({
        path: field.id,
        structId: source.id,
        fieldId: field.id,
        ui: field.ui,
        value: field.value,
      });
    }
  }

  return fields;
}

/**
 * Format a decoded memory-map field value for read-only display (e.g. channel table).
 */
export function formatMemoryMapFieldValue(
  value: RadioSettingValue | undefined,
  field: Pick<RadioMemoryMapUiField, 'value' | 'fieldId'>,
): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (field.value?.kind === 'enum' && typeof value === 'string') {
    return value;
  }

  if (field.value?.kind === 'boolean' || typeof value === 'boolean') {
    if (field.fieldId === 'wide') {
      return value ? 'Wide' : 'Narrow';
    }

    if (field.fieldId === 'scan') {
      return value ? 'On' : 'Off';
    }

    return value ? 'On' : 'Off';
  }

  if (field.fieldId === 'lowpower' && typeof value === 'number') {
    return value === 0 ? 'High' : 'Low';
  }

  if (field.fieldId === 'scode' && typeof value === 'number') {
    return String(value + 1);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

/**
 * Group UI fields by their ui.group key, preserving first-seen group order.
 */
export function groupMemoryMapUiFields(fields: RadioMemoryMapUiField[]): Map<string, RadioMemoryMapUiField[]> {
  const groups = new Map<string, RadioMemoryMapUiField[]>();

  for (const field of fields) {
    const existing = groups.get(field.ui.group);

    if (existing) {
      existing.push(field);
    } else {
      groups.set(field.ui.group, [field]);
    }
  }

  return groups;
}
