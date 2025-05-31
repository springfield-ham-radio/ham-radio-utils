export function bcdToNumber(data: Uint8Array, offset?: number, length?: number): number {
  let bcd = 0;
  const size = length ?? data.length;

  for (let i = offset ?? 0; i < size; i++) {
    bcd |= data[i] << (8 * i);
  }

  return parseInt(bcd.toString(16), 10) * 10;
}
