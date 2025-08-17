export const toHexWords = (data: Uint8Array): string => {
  const hexData = Buffer.from(data).toString('hex');
  let formattedData = '';

  for (let index = 0; index < hexData.length; index += 4) {
    if (index !== 0) {
      formattedData += ' ';
    }

    formattedData += hexData.slice(index, index + 4);
  }

  return formattedData;
};
