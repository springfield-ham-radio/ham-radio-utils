import {
  Frequency,
  type RadioChannel,
  type RadioMemoryConfig,
  type RadioMemoryMap,
  type RadioMemoryMapToneValue,
  type RadioProgram,
  type RadioProgrammedChannel,
  type RadioSettings,
  type RadioSettingValue,
  type RadioTone,
  RadioToneType,
} from '@springfield/ham-radio-api';
import { decodeMemoryMap, encodeMemoryMap } from './memory-map-codec.js';

function isToneValue(value: RadioSettingValue | undefined): value is RadioMemoryMapToneValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'mode' in value);
}

function toneToRadioTone(value: RadioSettingValue | undefined): RadioTone {
  if (!isToneValue(value) || value.mode === 'none') {
    return { tone: 0, type: RadioToneType.CTCSS };
  }

  if (value.mode === 'ctcss') {
    return { tone: value.value, type: RadioToneType.CTCSS };
  }

  return { tone: value.code, type: RadioToneType.DCS };
}

function radioToneToMapTone(tone: RadioTone | undefined): RadioMemoryMapToneValue {
  if (!tone || !tone.tone) {
    return { mode: 'none' };
  }

  if (tone.type === RadioToneType.DCS) {
    return { mode: 'dcs', code: Number(tone.tone), polarity: 'N' };
  }

  return { mode: 'ctcss', value: Number(tone.tone) };
}

function asRecord(value: RadioSettingValue | undefined): Record<string, RadioSettingValue> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, RadioSettingValue>;
}

/**
 * Project decoded memory-map channel structs into RadioProgrammedChannel[].
 */
export function bindingsToChannels(
  memoryMap: RadioMemoryMap,
  settings: RadioSettings,
): RadioProgrammedChannel[] {
  const bindings = memoryMap.channelBindings;

  if (!bindings) {
    return [];
  }

  const records = settings[bindings.records];
  const names = bindings.names ? settings[bindings.names] : undefined;
  const recordItems = Array.isArray(records) ? records : [];
  const nameItems = Array.isArray(names) ? names : [];
  const nameField = bindings.nameField ?? 'name';
  const boundFieldIds = new Set([
    bindings.receiveFrequency,
    bindings.transmitFrequency,
    bindings.receiveTone,
    bindings.transmitTone,
  ]);

  const channels: RadioProgrammedChannel[] = [];

  for (let index = 0; index < recordItems.length; index += 1) {
    const record = asRecord(recordItems[index]);

    if (!record) {
      continue;
    }

    const nameRecord = asRecord(nameItems[index]);
    const nameValue = nameRecord?.[nameField];
    const name = typeof nameValue === 'string' ? nameValue : '';

    const receiveFrequency = Number(record[bindings.receiveFrequency] ?? 0);
    const transmitFrequency = Number(record[bindings.transmitFrequency] ?? 0);

    const channelSettings: RadioSettings = {};

    for (const [fieldId, fieldValue] of Object.entries(record)) {
      if (boundFieldIds.has(fieldId) || fieldId.startsWith('_')) {
        continue;
      }

      channelSettings[fieldId] = fieldValue;
    }

    // Map Chirp lowpower index onto legacy transmitPower watts for UV-5R UI compatibility.
    if (typeof channelSettings.lowpower === 'number') {
      channelSettings.transmitPower = channelSettings.lowpower === 0 ? 5 : 1;
    }

    if (typeof channelSettings.wide === 'boolean') {
      channelSettings.mode = channelSettings.wide ? 'FM' : 'NFM';
    }

    if (typeof channelSettings.scan === 'boolean') {
      channelSettings.skip = channelSettings.scan ? '' : 'S';
    }

    const radioChannel: RadioChannel = {
      name,
      receiveFrequency: Frequency(receiveFrequency),
      transmitFrequency: Frequency(transmitFrequency),
      receiveTone: toneToRadioTone(record[bindings.receiveTone]),
      transmitTone: toneToRadioTone(record[bindings.transmitTone]),
    };

    channels.push({
      channelNumber: index,
      radioChannel,
      settings: Object.keys(channelSettings).length > 0 ? channelSettings : undefined,
    });
  }

  return channels;
}

/**
 * Strip channel-bound structs from decoded settings so RadioProgram.settings
 * only contains radio-wide settings.
 */
export function settingsWithoutChannels(memoryMap: RadioMemoryMap, settings: RadioSettings): RadioSettings {
  const bindings = memoryMap.channelBindings;

  if (!bindings) {
    return settings;
  }

  const next: RadioSettings = { ...settings };
  delete next[bindings.records];

  if (bindings.names) {
    delete next[bindings.names];
  }

  return next;
}

/**
 * Merge RadioProgram channels back into a memory-map settings bag for encode.
 */
export function programToChannelSettings(memoryMap: RadioMemoryMap, program: RadioProgram): RadioSettings {
  const bindings = memoryMap.channelBindings;

  if (!bindings) {
    return program.settings;
  }

  const recordsStruct = memoryMap.structs.find((struct) => struct.id === bindings.records);
  const namesStruct = bindings.names ? memoryMap.structs.find((struct) => struct.id === bindings.names) : undefined;
  const count = recordsStruct?.count ?? 0;
  const nameField = bindings.nameField ?? 'name';

  const records: RadioSettingValue[] = Array.from({ length: count }, () => null);
  const names: RadioSettingValue[] = Array.from({ length: count }, () => null);

  for (const programmed of program.channels) {
    const index = programmed.channelNumber;

    if (index < 0 || index >= count) {
      continue;
    }

    if (typeof programmed.radioChannel === 'string') {
      continue;
    }

    const channel = programmed.radioChannel;
    const channelSettings = programmed.settings ?? {};
    const record: Record<string, RadioSettingValue> = {
      [bindings.receiveFrequency]: channel.receiveFrequency,
      [bindings.transmitFrequency]: channel.transmitFrequency,
      [bindings.receiveTone]: radioToneToMapTone(channel.receiveTone),
      [bindings.transmitTone]: radioToneToMapTone(channel.transmitTone),
    };

    for (const [key, value] of Object.entries(channelSettings)) {
      if (key === 'transmitPower') {
        record.lowpower = value === 5 || value === 4 || value === 0 ? 0 : 1;
        continue;
      }

      if (key === 'mode') {
        record.wide = value === 'FM';
        continue;
      }

      if (key === 'skip') {
        record.scan = value !== 'S';
        continue;
      }

      record[key] = value;
    }

    if (record.lowpower === undefined) {
      record.lowpower = 0;
    }

    if (record.wide === undefined) {
      record.wide = true;
    }

    if (record.scan === undefined) {
      record.scan = true;
    }

    records[index] = record;
    names[index] = { [nameField]: channel.name ?? '' };
  }

  const bag: RadioSettings = { ...program.settings, [bindings.records]: records };

  if (bindings.names && namesStruct) {
    bag[bindings.names] = names;
  }

  return bag;
}

/**
 * Decode a full RadioProgram (channels + radio-wide settings) from memory.
 */
export function decodeRadioProgram(
  memoryMap: RadioMemoryMap,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
): RadioProgram {
  const decoded = decodeMemoryMap(memoryMap, contents, memoryConfig);

  return {
    channels: bindingsToChannels(memoryMap, decoded),
    settings: settingsWithoutChannels(memoryMap, decoded),
  };
}

/**
 * Encode a RadioProgram into an existing memory image (patch in place).
 */
export function encodeRadioProgram(
  memoryMap: RadioMemoryMap,
  program: RadioProgram,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
): Uint8Array {
  const bag = programToChannelSettings(memoryMap, program);
  return encodeMemoryMap(memoryMap, bag, contents, memoryConfig);
}
