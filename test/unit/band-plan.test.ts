import { describe, expect, it } from 'vitest';
import { BandPlan } from '../../src/utils/band-plan.js';
import { operatorClassToLicenseClassId } from '../../src/utils/operator-class-mapper.js';
import licenseClassesData from '../../src/db/license-classes.json' with { type: 'json' };

interface LicenseClass {
  id: string;
  name: string;
}

const LICENSE_CLASSES = licenseClassesData as LicenseClass[];

function idFor(name: string): string {
  return LICENSE_CLASSES.find((licenseClass) => licenseClass.name === name)!.id;
}

describe('BandPlan', () => {
  const bandPlan = new BandPlan();

  describe('findBandByFrequency', () => {
    it('should find the 160 Meter band for 1.9 MHz', () => {
      const band = bandPlan.findBandByFrequency(1_900_000);

      expect(band?.name).toBe('160 Meter');
    });

    it('should find the 80 Meter band for 3.8 MHz', () => {
      const band = bandPlan.findBandByFrequency(3_800_000);

      expect(band?.name).toBe('80 Meter');
    });

    it('should find the 40 Meter band for 7.2 MHz', () => {
      const band = bandPlan.findBandByFrequency(7_200_000);

      expect(band?.name).toBe('40 Meter');
    });

    it('should find the 20 Meter band for 14.2 MHz', () => {
      const band = bandPlan.findBandByFrequency(14_200_000);

      expect(band?.name).toBe('20 Meter');
    });

    it('should find the 30 Meter band for 10.12 MHz', () => {
      const band = bandPlan.findBandByFrequency(10_120_000);

      expect(band?.name).toBe('30 Meter');
    });

    it('should find the 17 Meter band for 18.11 MHz', () => {
      const band = bandPlan.findBandByFrequency(18_110_000);

      expect(band?.name).toBe('17 Meter');
    });

    it('should find the 12 Meter band for 24.93 MHz', () => {
      const band = bandPlan.findBandByFrequency(24_930_000);

      expect(band?.name).toBe('12 Meter');
    });

    it('should find the 6 Meter band for 50.125 MHz', () => {
      const band = bandPlan.findBandByFrequency(50_125_000);

      expect(band?.name).toBe('6 Meter');
    });

    it('should find the 2 Meter band for 146.52 MHz', () => {
      const band = bandPlan.findBandByFrequency(146_520_000);

      expect(band?.name).toBe('2 Meter');
    });

    it('should find the 1.25 Meter band for 222–225 MHz', () => {
      expect(bandPlan.findBandByFrequency(222_240_000)?.name).toBe('1.25 Meter');
      expect(bandPlan.findBandByFrequency(222_500_000)?.name).toBe('1.25 Meter');
      expect(bandPlan.findBandByFrequency(223_200_000)?.name).toBe('1.25 Meter');
      expect(bandPlan.findBandByFrequency(223_340_000)?.name).toBe('1.25 Meter');
    });

    it('should find the 33 Centimeter band for 902 MHz', () => {
      expect(bandPlan.findBandByFrequency(902_012_500)?.name).toBe('33 Centimeter');
      expect(bandPlan.findBandByFrequency(902_187_500)?.name).toBe('33 Centimeter');
    });

    it('should find the 23 Centimeter band for 1272–1273 MHz', () => {
      expect(bandPlan.findBandByFrequency(1_272_400_000)?.name).toBe('23 Centimeter');
      expect(bandPlan.findBandByFrequency(1_273_100_000)?.name).toBe('23 Centimeter');
    });

    it('should prefer an exact FRS channel over the overlapping GMRS envelope', () => {
      expect(bandPlan.findBandByFrequency(462_562_500)?.name).toBe('FRS/GMRS-1');
      expect(bandPlan.findBandByFrequency(467_562_500)?.name).toBe('FRS/GMRS-2');
      expect(bandPlan.findBandByFrequency(467_550_000)?.name).toBe('GMRS');
    });

    it('should find Weather Radio for NOAA WX1–WX7 and Environment Canada WX8–WX10', () => {
      expect(bandPlan.findBandByFrequency(162_550_000)?.name).toBe('Weather Radio');
      expect(bandPlan.findBandByFrequency(162_400_000)?.name).toBe('Weather Radio');
      expect(bandPlan.findBandByFrequency(161_650_000)?.name).toBe('Weather Radio-8');
      expect(bandPlan.findBandByFrequency(161_775_000)?.name).toBe('Weather Radio-9');
      expect(bandPlan.findBandByFrequency(163_275_000)?.name).toBe('Weather Radio-10');
    });

    it('should not treat GHz-scale values as HF amateur bands', () => {
      expect(bandPlan.findBandByFrequency(1_800_000_000)?.name).not.toBe('160 Meter');
      expect(bandPlan.findBandByFrequency(7_000_000_000)?.name).not.toBe('40 Meter');
      expect(bandPlan.findBandByFrequency(14_000_000_000)?.name).not.toBe('20 Meter');
    });

    it('should return undefined for a frequency outside every band', () => {
      expect(bandPlan.findBandByFrequency(1_000_000)).toBeUndefined();
    });
  });

  describe('findPrivilegeById', () => {
    it('should return the license class for a known ID', () => {
      const technicianId = idFor('Technician');

      expect(bandPlan.findPrivilegeById(technicianId)?.name).toBe('Technician');
    });
  });

  describe('hasPrivilege', () => {
    it('should deny Technician transmit on 160 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(1_900_000, technicianId)).toBe(false);
    });

    it('should allow General transmit on 160 Meter', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(1_900_000, generalId)).toBe(true);
    });

    it('should deny Technician transmit on 30 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(10_120_000, technicianId)).toBe(false);
    });

    it('should allow General transmit on 30 Meter', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(10_120_000, generalId)).toBe(true);
    });

    it('should allow Technician transmit on 6 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(50_125_000, technicianId)).toBe(true);
    });

    it('should allow Technician transmit on 2 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(146_520_000, technicianId)).toBe(true);
    });

    it('should allow Technician transmit on 70 Centimeter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(446_000_000, technicianId)).toBe(true);
    });

    it('should allow Technician transmit on 1.25 Meter, 33 Centimeter, and 23 Centimeter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(223_200_000, technicianId)).toBe(true);
      expect(bandPlan.hasPrivilege(902_075_000, technicianId)).toBe(true);
      expect(bandPlan.hasPrivilege(1_272_400_000, technicianId)).toBe(true);
    });

    it('should deny Technician transmit on GMRS frequencies', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(467_550_000, technicianId)).toBe(false);
    });

    it('should allow GMRS license transmit on GMRS frequencies', () => {
      expect(bandPlan.hasPrivilege(467_550_000, idFor('GMRS'))).toBe(true);
    });

    it('should allow General transmit on license-free FRS channels', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(462_562_500, generalId)).toBe(true);
      expect(bandPlan.hasPrivilege(467_562_500, generalId)).toBe(true);
    });

    it('should deny General transmit on GMRS repeater inputs', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(467_550_000, generalId)).toBe(false);
    });

    it('should return false when the frequency is not in any band', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(1_000_000, technicianId)).toBe(false);
    });
  });
});
