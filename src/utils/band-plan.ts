import type { SpectrumBand } from '@springfield/ham-radio-api';
import bandsData from '../db/bands.json' with { type: 'json' };
import licenseClassesData from '../db/license-classes.json' with { type: 'json' };

interface LicenseClass {
  id: string;
  name: string;
}

export class BandPlan {
  private bands: SpectrumBand[];
  private licenseClasses: Map<string, LicenseClass>;

  constructor() {
    this.bands = bandsData as SpectrumBand[];
    this.licenseClasses = new Map((licenseClassesData as LicenseClass[]).map((licenseClass) => [licenseClass.id, licenseClass]));
  }

  /**
   * Finds the spectrum band that contains the given frequency
   * @param frequency The frequency in Hz to find the band for
   * @returns The spectrum band containing the frequency, or undefined if no band contains it
   */
  findBandByFrequency(frequency: number): SpectrumBand | undefined {
    return this.bands.find((band) => frequency >= band.lowerFrequency && frequency <= band.upperFrequency);
  }

  /**
   * Finds a license class by its ID
   * @param id The ID of the license class to find
   * @returns The license class with the given ID, or undefined if not found
   */
  findPrivilegeById(id: string): LicenseClass | undefined {
    return this.licenseClasses.get(id);
  }

  /**
   * Returns whether the given license class may transmit on the frequency.
   *
   * Looks up the band that contains the frequency and checks that band's
   * privileges list. Frequencies outside every known band return false.
   *
   * @param frequencyHz - Frequency in Hz
   * @param licenseClassId - Springfield license-class ID
   * @returns true when the class has privilege on that frequency
   */
  hasPrivilege(frequencyHz: number, licenseClassId: string): boolean {
    const band = this.findBandByFrequency(frequencyHz);

    if (!band) {
      return false;
    }

    return (band.privileges as string[]).includes(licenseClassId);
  }
}
