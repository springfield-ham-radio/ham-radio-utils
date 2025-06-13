import type { Frequency, SpectrumBand } from '@springfield/ham-radio-api';

export const frequencyDisplay = (frequency: Frequency, band: SpectrumBand): string => {
  const frequencyDisplay = frequency / band.frequencyDisplayBaseMultiplier;
  return frequencyDisplay.toFixed(band.frequencyDisplayNumberDecimals);
};
