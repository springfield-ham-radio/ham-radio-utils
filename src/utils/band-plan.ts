import { SpectrumBand } from '@springfield/ham-radio-api';
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
}
