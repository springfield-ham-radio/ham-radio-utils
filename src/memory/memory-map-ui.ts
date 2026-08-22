import type { RadioMemoryMap, RadioMemoryMapFieldUi, RadioMemoryMapValueKind } from '@springfield/ham-radio-api';

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

/**
 * Collect writable UI fields from a memory map, in declaration order.
 */
export function collectMemoryMapUiFields(memoryMap: RadioMemoryMap): RadioMemoryMapUiField[] {
  const fields: RadioMemoryMapUiField[] = [];
  const channelStructIds = new Set<string>();

  if (memoryMap.channelBindings) {
    channelStructIds.add(memoryMap.channelBindings.records);

    if (memoryMap.channelBindings.names) {
      channelStructIds.add(memoryMap.channelBindings.names);
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
