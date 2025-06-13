export const numberToBcd = (value: number): Uint8Array => {
  const digits = value.toString(10);
  const numberOfBytes = Math.ceil(digits.length / 2);

  const data = new Uint8Array(numberOfBytes);

  let bcd = parseInt(digits, 16);

  for (let i = 0; i < numberOfBytes; i++) {
    data[i] = bcd & 0xff;
    bcd >>= 8;
  }

  return data;
};
