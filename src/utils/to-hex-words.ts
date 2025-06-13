export const toHexWords = (data: Uint8Array): string => {
  const hexData = Buffer.from(data).toString('hex');
  let formattedData = '';

  for (let i = 0; i < hexData.length; i += 4) {
    if (0 != i) {
      formattedData += ' ';
    }

    formattedData += hexData.substring(i, i + 4);
  }

  return formattedData;
};
