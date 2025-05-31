import { sprintf } from 'sprintf-js';
import { toHexWords } from './to-hex-words.js';
import { RadioMemorySegment } from '@springfield/ham-radio-api';

export function formatSegment(segment: RadioMemorySegment): string {
  return sprintf('%04X : %s', segment.startAddress, toHexWords(segment.data));
}
