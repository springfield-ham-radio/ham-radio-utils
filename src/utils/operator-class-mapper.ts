import licenseClassesData from '../db/license-classes.json' with { type: 'json' };

interface LicenseClass {
  id: string;
  name: string;
}

const LICENSE_CLASSES = licenseClassesData as LicenseClass[];

const TECHNICIAN_ID = LICENSE_CLASSES.find((licenseClass) => licenseClass.name === 'Technician')!.id;
const GENERAL_ID = LICENSE_CLASSES.find((licenseClass) => licenseClass.name === 'General')!.id;
const EXTRA_ID = LICENSE_CLASSES.find((licenseClass) => licenseClass.name === 'Amateur Extra')!.id;
const ADVANCED_ID = LICENSE_CLASSES.find((licenseClass) => licenseClass.name === 'Advanced (Grandfathered)')!.id;
const NOVICE_ID = LICENSE_CLASSES.find((licenseClass) => licenseClass.name === 'Novice (Grandfathered)')!.id;

/**
 * Maps a Callook.info / FCC operator-class name to a Springfield license-class ID.
 *
 * Callook returns values such as TECHNICIAN, GENERAL, and EXTRA. Club, military,
 * and RACES records often have an empty operator class and map to undefined.
 *
 * @param operClass - Operator class string from Callook or an equivalent FCC source
 * @returns The matching license-class ID, or undefined when no personal class applies
 */
export function operatorClassToLicenseClassId(operClass: string): string | undefined {
  const normalized = operClass.trim().toUpperCase().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return undefined;
  }

  switch (normalized) {
    case 'TECHNICIAN':
    case 'TECHNICIAN PLUS':
      return TECHNICIAN_ID;
    case 'GENERAL':
      return GENERAL_ID;
    case 'EXTRA':
    case 'AMATEUR EXTRA':
      return EXTRA_ID;
    case 'ADVANCED':
      return ADVANCED_ID;
    case 'NOVICE':
      return NOVICE_ID;
    default:
      return undefined;
  }
}
