import { Frequency, SpectrumBand } from '@springfield/ham-radio-api';

export function frequencyDisplay(frequency: Frequency, band: SpectrumBand): string {
  const frequencyDisplay = frequency / band.frequencyDisplayBaseMultiplier;
  return frequencyDisplay.toFixed(band.frequencyDisplayNumberDecimals);
}
