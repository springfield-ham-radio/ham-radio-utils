import { describe, it } from 'node:test';
import { expect } from 'chai';
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

describe('operatorClassToLicenseClassId', () => {
  it('should map TECHNICIAN to the Technician license class', () => {
    expect(operatorClassToLicenseClassId('TECHNICIAN')).to.equal(idFor('Technician'));
  });

  it('should map TECHNICIAN PLUS to the Technician license class', () => {
    expect(operatorClassToLicenseClassId('TECHNICIAN PLUS')).to.equal(idFor('Technician'));
  });

  it('should map GENERAL to the General license class', () => {
    expect(operatorClassToLicenseClassId('GENERAL')).to.equal(idFor('General'));
  });

  it('should map EXTRA to the Amateur Extra license class', () => {
    expect(operatorClassToLicenseClassId('EXTRA')).to.equal(idFor('Amateur Extra'));
  });

  it('should map ADVANCED to the Advanced (Grandfathered) license class', () => {
    expect(operatorClassToLicenseClassId('ADVANCED')).to.equal(idFor('Advanced (Grandfathered)'));
  });

  it('should map NOVICE to the Novice (Grandfathered) license class', () => {
    expect(operatorClassToLicenseClassId('NOVICE')).to.equal(idFor('Novice (Grandfathered)'));
  });

  it('should normalize lowercase and surrounding whitespace', () => {
    expect(operatorClassToLicenseClassId('  technician  ')).to.equal(idFor('Technician'));
  });

  it('should return undefined for an empty operator class', () => {
    expect(operatorClassToLicenseClassId('')).to.be.undefined;
    expect(operatorClassToLicenseClassId('   ')).to.be.undefined;
  });

  it('should return undefined for an unknown operator class', () => {
    expect(operatorClassToLicenseClassId('CLUB')).to.be.undefined;
  });
});
