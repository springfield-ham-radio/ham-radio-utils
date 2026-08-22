import { describe, it } from 'node:test';
import { expect } from 'chai';
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

      expect(band?.name).to.equal('160 Meter');
    });

    it('should find the 80 Meter band for 3.8 MHz', () => {
      const band = bandPlan.findBandByFrequency(3_800_000);

      expect(band?.name).to.equal('80 Meter');
    });

    it('should find the 40 Meter band for 7.2 MHz', () => {
      const band = bandPlan.findBandByFrequency(7_200_000);

      expect(band?.name).to.equal('40 Meter');
    });

    it('should find the 20 Meter band for 14.2 MHz', () => {
      const band = bandPlan.findBandByFrequency(14_200_000);

      expect(band?.name).to.equal('20 Meter');
    });

    it('should find the 2 Meter band for 146.52 MHz', () => {
      const band = bandPlan.findBandByFrequency(146_520_000);

      expect(band?.name).to.equal('2 Meter');
    });

    it('should prefer an exact FRS channel over the overlapping GMRS envelope', () => {
      expect(bandPlan.findBandByFrequency(462_562_500)?.name).to.equal('FRS/GMRS-1');
      expect(bandPlan.findBandByFrequency(467_562_500)?.name).to.equal('FRS/GMRS-2');
      expect(bandPlan.findBandByFrequency(467_550_000)?.name).to.equal('GMRS');
    });

    it('should not treat GHz-scale values as HF amateur bands', () => {
      expect(bandPlan.findBandByFrequency(1_800_000_000)?.name).to.not.equal('160 Meter');
      expect(bandPlan.findBandByFrequency(7_000_000_000)?.name).to.not.equal('40 Meter');
      expect(bandPlan.findBandByFrequency(14_000_000_000)?.name).to.not.equal('20 Meter');
    });

    it('should return undefined for a frequency outside every band', () => {
      expect(bandPlan.findBandByFrequency(1_000_000)).to.be.undefined;
    });
  });

  describe('findPrivilegeById', () => {
    it('should return the license class for a known ID', () => {
      const technicianId = idFor('Technician');

      expect(bandPlan.findPrivilegeById(technicianId)?.name).to.equal('Technician');
    });
  });

  describe('hasPrivilege', () => {
    it('should deny Technician transmit on 160 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(1_900_000, technicianId)).to.be.false;
    });

    it('should allow General transmit on 160 Meter', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(1_900_000, generalId)).to.be.true;
    });

    it('should allow Technician transmit on 2 Meter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(146_520_000, technicianId)).to.be.true;
    });

    it('should allow Technician transmit on 70 Centimeter', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(446_000_000, technicianId)).to.be.true;
    });

    it('should deny Technician transmit on GMRS frequencies', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(467_550_000, technicianId)).to.be.false;
    });

    it('should allow GMRS license transmit on GMRS frequencies', () => {
      expect(bandPlan.hasPrivilege(467_550_000, idFor('GMRS'))).to.be.true;
    });

    it('should allow General transmit on license-free FRS channels', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(462_562_500, generalId)).to.be.true;
      expect(bandPlan.hasPrivilege(467_562_500, generalId)).to.be.true;
    });

    it('should deny General transmit on GMRS repeater inputs', () => {
      const generalId = operatorClassToLicenseClassId('GENERAL')!;

      expect(bandPlan.hasPrivilege(467_550_000, generalId)).to.be.false;
    });

    it('should return false when the frequency is not in any band', () => {
      const technicianId = operatorClassToLicenseClassId('TECHNICIAN')!;

      expect(bandPlan.hasPrivilege(1_000_000, technicianId)).to.be.false;
    });
  });
});
