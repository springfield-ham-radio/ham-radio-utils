import { sprintf } from 'sprintf-js';
import { toHexWords } from './to-hex-words.js';

export const formatMemoryData = (address: number, data: Uint8Array): string => {
  return sprintf('%04X : %s', address, toHexWords(data));
};
