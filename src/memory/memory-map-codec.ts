import type {
  RadioMemoryConfig,
  RadioMemoryMap,
  RadioMemoryMapField,
  RadioMemoryMapStruct,
  RadioMemoryMapValueKind,
  RadioSettings,
  RadioSettingValue,
} from '@springfield/ham-radio-api';

const DEFAULT_DTMF_CHARSET = '0123456789 *#ABCD';

/**
 * Parse a seek address from a number or hex/decimal string.
 */
export function parseSeekAddress(seek: number | string): number {
  if (typeof seek === 'number') {
    return seek;
  }

  const trimmed = seek.trim();

  if (/^0x/i.test(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }

  return Number.parseInt(trimmed, 10);
}

/**
 * Map a radio EEPROM address to an offset in the memory buffer.
 *
 * Packed buffers (driver read) concatenate segments in config order.
 * Sparse buffers that cover the highest segment end address use absolute offsets.
 */
export function radioAddressToBufferOffset(
  radioAddress: number,
  memoryConfig: RadioMemoryConfig,
  bufferLength: number,
): number {
  const segments = Object.values(memoryConfig.segments);
  const maxEndAddress = Math.max(...segments.map((segment) => segment.endAddress));

  if (bufferLength >= maxEndAddress + 1) {
    return radioAddress;
  }

  let offset = 0;

  for (const segment of segments) {
    if (radioAddress >= segment.startAddress && radioAddress <= segment.endAddress) {
      return offset + (radioAddress - segment.startAddress);
    }

    offset += segment.endAddress - segment.startAddress + 1;
  }

  throw new Error(`Radio address 0x${radioAddress.toString(16)} is not in any memory segment`);
}

function bufferOffsetFor(radioAddress: number, memoryConfig: RadioMemoryConfig, contents: Uint8Array): number {
  return radioAddressToBufferOffset(radioAddress, memoryConfig, contents.length);
}

function readByte(contents: Uint8Array, offset: number): number {
  if (offset < 0 || offset >= contents.length) {
    throw new RangeError(`Memory-map read out of bounds at offset ${offset}`);
  }

  return contents[offset];
}

function writeByte(contents: Uint8Array, offset: number, value: number): void {
  if (offset < 0 || offset >= contents.length) {
    throw new RangeError(`Memory-map write out of bounds at offset ${offset}`);
  }

  contents[offset] = value & 0xff;
}

function decodeRawValue(kind: RadioMemoryMapValueKind | undefined, raw: number | number[]): RadioSettingValue {
  if (!kind) {
    return typeof raw === 'number' ? raw : raw;
  }

  switch (kind.kind) {
    case 'integer':
      return typeof raw === 'number' ? raw : raw[0];
    case 'boolean':
      return (typeof raw === 'number' ? raw : raw[0]) !== 0;
    case 'enum': {
      const index = typeof raw === 'number' ? raw : raw[0];
      return kind.values[index] ?? kind.values[0] ?? '';
    }
    case 'ascii': {
      const bytes = typeof raw === 'number' ? [raw] : raw;
      let text = '';

      for (const byte of bytes) {
        if (byte === 0xff || byte === 0x00) {
          break;
        }

        text += String.fromCodePoint(byte);
      }

      return text.trimEnd();
    }
    case 'digits': {
      const bytes = typeof raw === 'number' ? [raw] : raw;
      let value = 0;

      for (const digit of bytes) {
        value = value * 10 + (digit & 0x0f);
      }

      return value * (kind.scale ?? 1);
    }
    case 'dtmf': {
      const bytes = typeof raw === 'number' ? [raw] : raw;
      const charset = kind.charset ?? DEFAULT_DTMF_CHARSET;
      let text = '';

      for (const byte of bytes) {
        if (byte >= 0x1f) {
          break;
        }

        if (byte < charset.length) {
          text += charset[byte];
        }
      }

      return text;
    }
    case 'bbcd': {
      const bytes = typeof raw === 'number' ? [raw] : raw;
      let value = 0;

      for (const byte of bytes) {
        value = value * 100 + ((byte >> 4) & 0x0f) * 10 + (byte & 0x0f);
      }

      return value;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function encodeRawValue(kind: RadioMemoryMapValueKind | undefined, value: RadioSettingValue, byteLength: number): number[] {
  const bytes = Array.from({ length: byteLength }, () => 0xff);

  if (!kind) {
    if (typeof value === 'number') {
      bytes[0] = value & 0xff;
    }

    return bytes;
  }

  switch (kind.kind) {
    case 'integer': {
      bytes[0] = typeof value === 'number' ? value & 0xff : 0;
      return bytes;
    }
    case 'boolean': {
      bytes[0] = value ? 1 : 0;
      return bytes;
    }
    case 'enum': {
      const index = typeof value === 'string' ? kind.values.indexOf(value) : -1;
      bytes[0] = index >= 0 ? index : 0;
      return bytes;
    }
    case 'ascii': {
      const text = typeof value === 'string' ? value : '';

      for (let index = 0; index < byteLength; index += 1) {
        bytes[index] = index < text.length ? (text.codePointAt(index) ?? 0xff) : 0xff;
      }

      return bytes;
    }
    case 'digits': {
      const scale = kind.scale ?? 1;
      let numeric = typeof value === 'number' ? Math.round(value / scale) : 0;

      for (let index = byteLength - 1; index >= 0; index -= 1) {
        bytes[index] = numeric % 10;
        numeric = Math.floor(numeric / 10);
      }

      return bytes;
    }
    case 'dtmf': {
      const text = typeof value === 'string' ? value : '';
      const charset = kind.charset ?? DEFAULT_DTMF_CHARSET;

      for (let index = 0; index < byteLength; index += 1) {
        if (index < text.length) {
          const charIndex = charset.indexOf(text[index]);
          bytes[index] = charIndex >= 0 ? charIndex : 0xff;
        } else {
          bytes[index] = 0xff;
        }
      }

      return bytes;
    }
    case 'bbcd': {
      let numeric = typeof value === 'number' ? value : 0;
      const digits: number[] = [];

      for (let index = 0; index < byteLength * 2; index += 1) {
        digits.unshift(numeric % 10);
        numeric = Math.floor(numeric / 10);
      }

      for (let index = 0; index < byteLength; index += 1) {
        bytes[index] = ((digits[index * 2] & 0x0f) << 4) | (digits[index * 2 + 1] & 0x0f);
      }

      return bytes;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function fieldByteLength(field: RadioMemoryMapField): number {
  if (field.type === 'u16') {
    return 2;
  }

  if (field.type === 'bits') {
    return 0;
  }

  if (
    field.value?.kind === 'ascii' ||
    field.value?.kind === 'digits' ||
    field.value?.kind === 'dtmf' ||
    field.value?.kind === 'bbcd'
  ) {
    return field.value.length;
  }

  return 1;
}

/**
 * Chirp-style bitfields: declaration order is MSB → LSB within each byte.
 */
class BitfieldCursor {
  private radioAddress: number;
  private bitIndex = -1;
  private currentByte = 0;
  private dirty = false;

  constructor(
    private readonly contents: Uint8Array,
    private readonly memoryConfig: RadioMemoryConfig,
    startRadioAddress: number,
  ) {
    this.radioAddress = startRadioAddress;
  }

  private load(): void {
    if (this.bitIndex >= 0) {
      return;
    }

    this.currentByte = readByte(this.contents, bufferOffsetFor(this.radioAddress, this.memoryConfig, this.contents));
    this.bitIndex = 7;
    this.dirty = false;
  }

  private flushByte(): void {
    if (this.dirty) {
      writeByte(this.contents, bufferOffsetFor(this.radioAddress, this.memoryConfig, this.contents), this.currentByte);
      this.dirty = false;
    }
  }

  read(width: number): number {
    let result = 0;

    for (let bit = 0; bit < width; bit += 1) {
      this.load();
      result = (result << 1) | ((this.currentByte >> this.bitIndex) & 1);
      this.bitIndex -= 1;

      if (this.bitIndex < 0) {
        this.radioAddress += 1;
      }
    }

    return result;
  }

  write(width: number, value: number): void {
    for (let bit = width - 1; bit >= 0; bit -= 1) {
      this.load();
      const mask = 1 << this.bitIndex;

      if ((value >> bit) & 1) {
        this.currentByte |= mask;
      } else {
        this.currentByte &= ~mask;
      }

      this.dirty = true;
      this.bitIndex -= 1;

      if (this.bitIndex < 0) {
        this.flushByte();
        this.radioAddress += 1;
      }
    }
  }

  /**
   * Absolute radio address of the next unused byte after this bitfield group.
   */
  nextRadioAddress(): number {
    this.flushByte();

    if (this.bitIndex >= 0) {
      return this.radioAddress + 1;
    }

    return this.radioAddress;
  }
}

function decodeStruct(
  struct: RadioMemoryMapStruct,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
  instanceIndex: number,
): Record<string, RadioSettingValue> {
  const base = parseSeekAddress(struct.seek) + instanceIndex * (struct.stride ?? 0);
  const result: Record<string, RadioSettingValue> = {};
  let radioAddress = base;
  let bitCursor: BitfieldCursor | undefined;

  for (const field of struct.fields) {
    if (field.type === 'bits') {
      if (!bitCursor) {
        bitCursor = new BitfieldCursor(contents, memoryConfig, radioAddress);
      }

      const raw = bitCursor.read(field.width ?? 1);

      if (!field.reserved) {
        result[field.id] = decodeRawValue(field.value ?? { kind: 'integer' }, raw);
      }

      continue;
    }

    if (bitCursor) {
      radioAddress = bitCursor.nextRadioAddress();
      bitCursor = undefined;
    }

    const length = fieldByteLength(field);
    const bytes: number[] = [];

    for (let index = 0; index < length; index += 1) {
      bytes.push(readByte(contents, bufferOffsetFor(radioAddress + index, memoryConfig, contents)));
    }

    if (field.type === 'u16') {
      const raw = bytes[0] | (bytes[1] << 8);

      if (!field.reserved) {
        result[field.id] = decodeRawValue(field.value ?? { kind: 'integer' }, raw);
      }
    } else if (!field.reserved) {
      result[field.id] = decodeRawValue(field.value, length === 1 ? bytes[0] : bytes);
    }

    radioAddress += length;
  }

  return result;
}

function encodeStruct(
  struct: RadioMemoryMapStruct,
  values: Record<string, RadioSettingValue>,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
  instanceIndex: number,
): void {
  const base = parseSeekAddress(struct.seek) + instanceIndex * (struct.stride ?? 0);
  let radioAddress = base;
  let bitCursor: BitfieldCursor | undefined;
  let bitStartAddress = base;

  for (const field of struct.fields) {
    if (field.type === 'bits') {
      if (!bitCursor) {
        bitStartAddress = radioAddress;
        bitCursor = new BitfieldCursor(contents, memoryConfig, bitStartAddress);
      }

      const width = field.width ?? 1;

      if (field.reserved) {
        // Advance by reading existing bits (preserves memory)
        bitCursor.read(width);
      } else {
        const encoded = encodeRawValue(field.value ?? { kind: 'integer' }, values[field.id] ?? 0, 1);
        bitCursor.write(width, encoded[0]);
      }

      continue;
    }

    if (bitCursor) {
      radioAddress = bitCursor.nextRadioAddress();
      bitCursor = undefined;
    }

    const length = fieldByteLength(field);

    if (field.reserved) {
      radioAddress += length;
      continue;
    }

    const settingValue = values[field.id];

    if (field.type === 'u16') {
      const encoded = encodeRawValue(field.value ?? { kind: 'integer' }, settingValue ?? 0, 1);
      const value = encoded[0] & 0xffff;
      writeByte(contents, bufferOffsetFor(radioAddress, memoryConfig, contents), value & 0xff);
      writeByte(contents, bufferOffsetFor(radioAddress + 1, memoryConfig, contents), (value >> 8) & 0xff);
    } else {
      const encoded = encodeRawValue(field.value, settingValue ?? (field.value?.kind === 'ascii' ? '' : 0), length);

      for (let index = 0; index < length; index += 1) {
        writeByte(contents, bufferOffsetFor(radioAddress + index, memoryConfig, contents), encoded[index]);
      }
    }

    radioAddress += length;
  }

  if (bitCursor) {
    bitCursor.nextRadioAddress();
  }
}

/**
 * Decode radio-wide settings from a memory image using a JSON memory map.
 */
export function decodeMemoryMap(
  memoryMap: RadioMemoryMap,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
): RadioSettings {
  const settings: RadioSettings = {};

  for (const struct of memoryMap.structs) {
    const count = struct.count ?? 1;

    if (count > 1) {
      const items: RadioSettingValue[] = [];

      for (let index = 0; index < count; index += 1) {
        items.push(decodeStruct(struct, contents, memoryConfig, index));
      }

      settings[struct.id] = items;
    } else {
      settings[struct.id] = decodeStruct(struct, contents, memoryConfig, 0);
    }
  }

  return settings;
}

/**
 * Encode radio-wide settings into an existing memory image in place.
 * Returns the same buffer for convenience.
 */
export function encodeMemoryMap(
  memoryMap: RadioMemoryMap,
  settings: RadioSettings,
  contents: Uint8Array,
  memoryConfig: RadioMemoryConfig,
): Uint8Array {
  for (const struct of memoryMap.structs) {
    const count = struct.count ?? 1;
    const value = settings[struct.id];

    if (count > 1) {
      const items = Array.isArray(value) ? value : [];

      for (let index = 0; index < count; index += 1) {
        const item = items[index];
        const record =
          item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, RadioSettingValue>) : {};
        encodeStruct(struct, record, contents, memoryConfig, index);
      }
    } else {
      const record =
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, RadioSettingValue>) : {};
      encodeStruct(struct, record, contents, memoryConfig, 0);
    }
  }

  return contents;
}
