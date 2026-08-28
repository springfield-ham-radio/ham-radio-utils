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

function noneTone(): RadioTone {
  return { tone: 0, type: RadioToneType.CTCSS };
}

function isNoneTone(tone: RadioTone | undefined): boolean {
  return !tone || !tone.tone;
}

function structHasField(struct: { fields: { id: string }[] } | undefined, fieldId: string): boolean {
  return Boolean(struct?.fields.some((field) => field.id === fieldId));
}

function transmitFrequencyFromRecord(record: Record<string, RadioSettingValue>, bindings: NonNullable<RadioMemoryMap['channelBindings']>): number {
  const receiveFrequency = Number(record[bindings.receiveFrequency] ?? 0);
  const offsetOrTransmit = Number(record[bindings.transmitFrequency] ?? 0);

  if (record.split === true) {
    return offsetOrTransmit;
  }

  if (record.duplex === '+') {
    return receiveFrequency + offsetOrTransmit;
  }

  if (record.duplex === '-') {
    return receiveFrequency - offsetOrTransmit;
  }

  // Kenwood stores simplex as duplex "" and offset 0. Empty duplex is not an absolute TX frequency.
  if (record.duplex === '') {
    return receiveFrequency;
  }

  if (record.duplex === undefined) {
    return bindings.transmitFrequency === bindings.receiveFrequency ? receiveFrequency : offsetOrTransmit;
  }

  return offsetOrTransmit;
}

function applyKenwoodToneMode(
  record: Record<string, RadioSettingValue>,
  bindings: NonNullable<RadioMemoryMap['channelBindings']>,
): { receiveTone: RadioTone; transmitTone: RadioTone } {
  const hasToneModeBits = 'tone_mode' in record || 'ctcss_mode' in record || 'dtcs_mode' in record;

  if (!hasToneModeBits) {
    return {
      receiveTone: toneToRadioTone(record[bindings.receiveTone]),
      transmitTone: toneToRadioTone(record[bindings.transmitTone]),
    };
  }

  if (record.tone_mode === true) {
    return { receiveTone: noneTone(), transmitTone: toneToRadioTone(record[bindings.transmitTone]) };
  }

  if (record.ctcss_mode === true) {
    const tone = toneToRadioTone(record[bindings.receiveTone]);
    return { receiveTone: tone, transmitTone: tone };
  }

  if (record.dtcs_mode === true) {
    const tone = toneToRadioTone(record.dtcs_code);
    return { receiveTone: tone, transmitTone: tone };
  }

  return { receiveTone: noneTone(), transmitTone: noneTone() };
}

function kenwoodUsedFlag(receiveFrequency: number, transmitFrequency: number): number {
  const frequency = transmitFrequency || receiveFrequency;

  if (frequency < 150_000_000) {
    return 0;
  }

  if (frequency < 400_000_000) {
    return 1;
  }

  return 2;
}

/** TM-D710 chmap band codes: 0=118 MHz, 5=144, 6=200, 7=300, 8=400, 9=800. */
function kenwoodChmapBand(receiveFrequency: number): number {
  if (receiveFrequency < 136_000_000) {
    return 0;
  }

  if (receiveFrequency < 200_000_000) {
    return 5;
  }

  if (receiveFrequency < 300_000_000) {
    return 6;
  }

  if (receiveFrequency < 400_000_000) {
    return 7;
  }

  if (receiveFrequency < 800_000_000) {
    return 8;
  }

  return 9;
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
  const extras = bindings.extras ? settings[bindings.extras] : undefined;
  const recordItems = Array.isArray(records) ? records : [];
  const nameItems = Array.isArray(names) ? names : [];
  const extraItems = Array.isArray(extras) ? extras : [];
  const nameField = bindings.nameField ?? 'name';
  const boundFieldIds = new Set([
    bindings.receiveFrequency,
    bindings.transmitFrequency,
    bindings.receiveTone,
    bindings.transmitTone,
    nameField,
  ]);

  const channels: RadioProgrammedChannel[] = [];

  for (let index = 0; index < recordItems.length; index += 1) {
    const record = asRecord(recordItems[index]);
    const extraRecord = asRecord(extraItems[index]);

    if (bindings.extras && extraItems.length > 0 && extraRecord === undefined) {
      continue;
    }

    if (!record) {
      continue;
    }

    const nameRecord = asRecord(nameItems[index]);
    const nameFromTable = typeof nameRecord?.[nameField] === 'string' ? nameRecord[nameField] : '';
    const nameFromRecord = typeof record[nameField] === 'string' ? record[nameField] : '';
    const name = nameFromTable || nameFromRecord;

    const receiveFrequency = Number(record[bindings.receiveFrequency] ?? 0);
    const transmitFrequency = transmitFrequencyFromRecord(record, bindings);
    const tones = applyKenwoodToneMode(record, bindings);

    const channelSettings: RadioSettings = {};

    for (const [fieldId, fieldValue] of Object.entries(record)) {
      if (boundFieldIds.has(fieldId) || fieldId.startsWith('_')) {
        continue;
      }

      channelSettings[fieldId] = fieldValue;
    }

    if (extraRecord) {
      for (const [fieldId, fieldValue] of Object.entries(extraRecord)) {
        if (fieldId.startsWith('_') || fieldId === 'used') {
          continue;
        }

        channelSettings[fieldId] = fieldValue;
      }

      if (typeof extraRecord.lockout === 'boolean') {
        channelSettings.skip = extraRecord.lockout ? 'S' : '';
      }
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

    if (typeof channelSettings.skip === 'boolean') {
      channelSettings.skip = channelSettings.skip ? 'S' : '';
    }

    const radioChannel: RadioChannel = {
      name,
      receiveFrequency: Frequency(receiveFrequency),
      transmitFrequency: Frequency(transmitFrequency),
      receiveTone: tones.receiveTone,
      transmitTone: tones.transmitTone,
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

  if (bindings.extras) {
    delete next[bindings.extras];
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
  const extrasStruct = bindings.extras ? memoryMap.structs.find((struct) => struct.id === bindings.extras) : undefined;
  const count = recordsStruct?.count ?? 0;
  const nameField = bindings.nameField ?? 'name';

  const records: RadioSettingValue[] = Array.from({ length: count }, () => null);
  const names: RadioSettingValue[] = Array.from({ length: count }, () => null);
  const extras: RadioSettingValue[] = Array.from({ length: count }, () => null);

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
    const receiveFrequency = Number(channel.receiveFrequency);
    const transmitFrequency = Number(channel.transmitFrequency);
    let offset = transmitFrequency;
    let duplex: RadioSettingValue = '';
    let split = false;

    if (transmitFrequency === receiveFrequency) {
      offset = 0;
      duplex = '';
    } else if (transmitFrequency > receiveFrequency) {
      offset = transmitFrequency - receiveFrequency;
      duplex = '+';
    } else {
      offset = receiveFrequency - transmitFrequency;
      duplex = '-';
    }

    if (channelSettings.split === true) {
      split = true;
      duplex = '';
      offset = transmitFrequency;
    }

    const usesOffset =
      'duplex' in channelSettings || extrasStruct || structHasField(recordsStruct, 'duplex');
    const usesKenwoodToneBits =
      'tone_mode' in channelSettings ||
      'ctcss_mode' in channelSettings ||
      extrasStruct ||
      structHasField(recordsStruct, 'tone_mode') ||
      structHasField(recordsStruct, 'ctcss_mode');

    const record: Record<string, RadioSettingValue> = {
      [bindings.receiveFrequency]: receiveFrequency,
      [bindings.transmitFrequency]: usesOffset ? offset : transmitFrequency,
      [bindings.receiveTone]: radioToneToMapTone(channel.receiveTone),
      [bindings.transmitTone]: radioToneToMapTone(channel.transmitTone),
    };

    if (usesOffset) {
      record.duplex = typeof channelSettings.duplex === 'string' ? channelSettings.duplex : duplex;
      record.split = typeof channelSettings.split === 'boolean' ? channelSettings.split : split;
      record.offset = offset;
    }

    if (usesKenwoodToneBits) {
      record.tone_mode = false;
      record.ctcss_mode = false;
      record.dtcs_mode = false;
      record.cross_mode = false;

      if (channel.transmitTone?.type === RadioToneType.DCS || channel.receiveTone?.type === RadioToneType.DCS) {
        record.dtcs_mode = true;
        record.dtcs_code = radioToneToMapTone(channel.transmitTone?.type === RadioToneType.DCS ? channel.transmitTone : channel.receiveTone);
      } else if (!isNoneTone(channel.receiveTone) && !isNoneTone(channel.transmitTone)) {
        record.ctcss_mode = true;
      } else if (!isNoneTone(channel.transmitTone)) {
        record.tone_mode = true;
      }
    }

    for (const [key, value] of Object.entries(channelSettings)) {
      if (key === 'transmitPower') {
        record.lowpower = value === 5 || value === 4 || value === 0 ? 0 : 1;
        continue;
      }

      if (key === 'mode') {
        record.wide = value === 'FM';
        record.mode = value;
        continue;
      }

      if (key === 'skip') {
        record.scan = value !== 'S';
        record.skip = value === 'S';
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

    if (namesStruct) {
      names[index] = { [nameField]: channel.name ?? '' };
    } else {
      record[nameField] = channel.name ?? '';
    }

    if (extrasStruct) {
      const extraRecord: Record<string, RadioSettingValue> = {
        used: kenwoodUsedFlag(receiveFrequency, transmitFrequency),
        lockout: channelSettings.skip === 'S' || channelSettings.lockout === true,
        group: typeof channelSettings.group === 'number' ? channelSettings.group : 0,
      };

      if (structHasField(extrasStruct, 'band')) {
        extraRecord.band = typeof channelSettings.band === 'number' ? channelSettings.band : kenwoodChmapBand(receiveFrequency);
      }

      extras[index] = extraRecord;
    }
  }

  const bag: RadioSettings = { ...program.settings, [bindings.records]: records };

  if (bindings.names && namesStruct) {
    bag[bindings.names] = names;
  }

  if (bindings.extras && extrasStruct) {
    bag[bindings.extras] = extras;
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
