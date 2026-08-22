import { describe, it } from 'node:test';
import { expect } from 'chai';
import { Frequency } from '@springfield/ham-radio-api';
import { BandPlan } from '../../src/utils/band-plan.js';
import { frequencyDisplay } from '../../src/utils/frequency-display.js';

describe('frequencyDisplay', () => {
  const bandPlan = new BandPlan();

  it('should format 160 Meter frequencies in MHz with 3 decimals', () => {
    const band = bandPlan.findBandByFrequency(1_900_000);

    expect(frequencyDisplay(Frequency(1_900_000), band!)).to.equal('1.900');
  });

  it('should format 40 Meter frequencies in MHz with 3 decimals', () => {
    const band = bandPlan.findBandByFrequency(7_200_000);

    expect(frequencyDisplay(Frequency(7_200_000), band!)).to.equal('7.200');
  });

  it('should format 15 Meter frequencies in MHz with 3 decimals', () => {
    const band = bandPlan.findBandByFrequency(21_300_000);

    expect(frequencyDisplay(Frequency(21_300_000), band!)).to.equal('21.300');
  });

  it('should format 60 Meter channel 3 without rounding to 5.359', () => {
    const band = bandPlan.findBandByFrequency(5_358_500);

    expect(frequencyDisplay(Frequency(5_358_500), band!)).to.equal('5.3585');
  });

  it('should format 2 Meter calling frequency in MHz with 4 decimals', () => {
    const band = bandPlan.findBandByFrequency(146_520_000);

    expect(frequencyDisplay(Frequency(146_520_000), band!)).to.equal('146.5200');
  });
});
