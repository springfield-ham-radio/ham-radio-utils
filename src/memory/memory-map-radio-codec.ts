import type {
  RadioCodec,
  RadioMemory,
  RadioMemoryConfig,
  RadioMemoryMap,
  RadioModelId,
  RadioProgram,
} from '@springfield/ham-radio-api';
import type { ILogLayer } from 'loglayer';
import { decodeRadioProgram, encodeRadioProgram } from './memory-map-channels.js';

/**
 * Compute the sparse image size that covers every configured memory segment.
 */
export function memoryImageSize(memoryConfig: RadioMemoryConfig): number {
  const ends = Object.values(memoryConfig.segments).map((segment) => segment.endAddress);
  return Math.max(...ends) + 1;
}

/**
 * Create a Chirp-like empty EEPROM image filled with 0xFF.
 */
export function createEmptyMemoryImage(totalSize: number): Uint8Array {
  const memory = new Uint8Array(totalSize);
  memory.fill(0xff);
  return memory;
}

export interface MemoryMapRadioCodecOptions {
  radioModel: RadioModelId;
  memoryMap: RadioMemoryMap;
  memoryConfig: RadioMemoryConfig;
  logger?: ILogLayer;
}

/**
 * Generic RadioCodec driven entirely by a JSON memory map + memoryConfig.
 * Radio modules that ship DSL JSON do not need TypeScript codecs.
 */
export class MemoryMapRadioCodec implements RadioCodec {
  private readonly radioModel: RadioModelId;
  private readonly memoryMap: RadioMemoryMap;
  private readonly memoryConfig: RadioMemoryConfig;
  private readonly logger: ILogLayer | undefined;

  constructor(options: MemoryMapRadioCodecOptions) {
    this.radioModel = options.radioModel;
    this.memoryMap = options.memoryMap;
    this.memoryConfig = options.memoryConfig;
    this.logger = options.logger;
  }

  decode(memory: RadioMemory): RadioProgram {
    try {
      return decodeRadioProgram(this.memoryMap, memory.contents, this.memoryConfig);
    } catch (error) {
      this.logger?.withError(error).warn('Failed to decode radio program from memory map');
      return { channels: [], settings: {} };
    }
  }

  encode(program: RadioProgram, memory: RadioMemory): RadioMemory {
    const totalSize = memoryImageSize(this.memoryConfig);
    const contents =
      memory.contents.length > 0 ? new Uint8Array(memory.contents) : createEmptyMemoryImage(totalSize);

    if (contents.length < totalSize) {
      const expanded = createEmptyMemoryImage(totalSize);
      expanded.set(contents);
      try {
        encodeRadioProgram(this.memoryMap, program, expanded, this.memoryConfig);
      } catch (error) {
        this.logger?.withError(error).warn('Failed to encode radio program into memory map');
      }

      this.logger?.debug(`Memory size: ${expanded.length} bytes`);
      return { contents: expanded, radioModel: this.radioModel };
    }

    try {
      encodeRadioProgram(this.memoryMap, program, contents, this.memoryConfig);
    } catch (error) {
      this.logger?.withError(error).warn('Failed to encode radio program into memory map');
    }

    this.logger?.debug(`Memory size: ${contents.length} bytes`);
    return { contents, radioModel: this.radioModel };
  }
}

/**
 * Create a memory-map codec from hydrated radio config fields.
 */
export function createMemoryMapCodec(options: MemoryMapRadioCodecOptions): RadioCodec {
  return new MemoryMapRadioCodec(options);
}
