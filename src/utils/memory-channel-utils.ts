import { sprintf } from 'sprintf-js';
import { toHexWords } from './to-hex-words.js';

export const formatChannel = (channelNumber: number, data: Uint8Array): string => sprintf('%2d : %s', channelNumber, toHexWords(data));
