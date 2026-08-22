import { describe, it } from 'node:test';
import { expect } from 'chai';
import bandsData from '../../src/db/bands.json' with { type: 'json' };

interface BandChannel {
  name: string;
  frequency: number;
}

interface Band {
  name: string;
  wavelength: number;
  lowerFrequency: number;
  upperFrequency: number;
  frequencyDisplayBaseMultiplier: number;
  frequencyDisplayNumberDecimals: number;
  channels?: BandChannel[];
}

const bands = bandsData as Band[];

function bandNamed(name: string): Band {
  const band = bands.find((entry) => entry.name === name);

  expect(band, `expected band ${name} to exist`).to.not.be.undefined;

  return band!;
}

describe('bands.json', () => {
  describe('US amateur band edges', () => {
    const amateurBandEdges: [string, number, number][] = [
      ['160 Meter', 1_800_000, 2_000_000],
      ['80 Meter', 3_500_000, 4_000_000],
      ['60 Meter', 5_332_000, 5_405_000],
      ['40 Meter', 7_000_000, 7_300_000],
      ['20 Meter', 14_000_000, 14_350_000],
      ['15 Meter', 21_000_000, 21_450_000],
      ['10 Meter', 28_000_000, 29_700_000],
      ['2 Meter', 144_000_000, 148_000_000],
      ['70 Centimeter', 420_000_000, 450_000_000],
    ];

    for (const [name, lowerFrequency, upperFrequency] of amateurBandEdges) {
      it(`should use FCC Part 97 edges in Hz for ${name}`, () => {
        const band = bandNamed(name);

        expect(band.lowerFrequency).to.equal(lowerFrequency);
        expect(band.upperFrequency).to.equal(upperFrequency);
      });
    }
  });

  describe('frequency units', () => {
    it('should keep every channel frequency within its band edges', () => {
      for (const band of bands) {
        for (const channel of band.channels ?? []) {
          expect(channel.frequency, `${band.name} ${channel.name}`).to.be.at.least(band.lowerFrequency);
          expect(channel.frequency, `${band.name} ${channel.name}`).to.be.at.most(band.upperFrequency);
        }
      }
    });

    it('should store 60 Meter channel centers in Hz', () => {
      const band = bandNamed('60 Meter');
      const frequencies = (band.channels ?? []).map((channel) => channel.frequency);

      expect(frequencies).to.deep.equal([5_332_000, 5_348_000, 5_358_500, 5_373_000, 5_405_000]);
    });

    it('should store Weather Radio WX3 at 162.475 MHz', () => {
      const band = bandNamed('Weather Radio');
      const weatherChannel = band.channels?.find((channel) => channel.name === 'WX3');

      expect(weatherChannel?.frequency).to.equal(162_475_000);
    });
  });

  describe('frequency display settings', () => {
    it('should display HF bands in MHz with 3 decimals', () => {
      const hfNames = ['160 Meter', '80 Meter', '40 Meter', '20 Meter', '15 Meter', '10 Meter'];

      for (const name of hfNames) {
        const band = bandNamed(name);

        expect(band.frequencyDisplayBaseMultiplier, name).to.equal(1_000_000);
        expect(band.frequencyDisplayNumberDecimals, name).to.equal(3);
      }
    });

    it('should display 60 Meter in MHz with 4 decimals so 5.3585 MHz is exact', () => {
      const band = bandNamed('60 Meter');

      expect(band.frequencyDisplayBaseMultiplier).to.equal(1_000_000);
      expect(band.frequencyDisplayNumberDecimals).to.equal(4);
    });
  });
});
