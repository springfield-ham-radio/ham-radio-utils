import type { RadioMemorySegment } from '@springfield/ham-radio-api';
import { sprintf } from 'sprintf-js';
import { toHexWords } from './to-hex-words.js';

export const formatSegment = (segment: RadioMemorySegment): string => {
  return sprintf('%04X : %s', segment.startAddress, toHexWords(segment.data));
};
