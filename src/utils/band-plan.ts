import type { SpectrumBand } from '@springfield/ham-radio-api';
import bandsData from '../db/bands.json' with { type: 'json' };
import licenseClassesData from '../db/license-classes.json' with { type: 'json' };

interface LicenseClass {
  id: string;
  name: string;
}

export class BandPlan {
  private readonly bands: SpectrumBand[];
  private readonly licenseClasses: Map<string, LicenseClass>;
  private readonly frsLicenseClassId: string | undefined;

  constructor() {
    this.bands = bandsData as SpectrumBand[];
    this.licenseClasses = new Map((licenseClassesData as LicenseClass[]).map((licenseClass) => [licenseClass.id, licenseClass]));
    this.frsLicenseClassId = [...this.licenseClasses.values()].find((licenseClass) => licenseClass.name === 'FRS')?.id;
  }

  /**
   * Finds the spectrum band that contains the given frequency.
   *
   * Channelized allocations (FRS, GMRS, weather) interleave in the same
   * MHz range. An exact channel match is preferred over a surrounding
   * band envelope so FRS interstitial frequencies are not treated as GMRS
   * repeater inputs.
   *
   * @param frequency The frequency in Hz to find the band for
   * @returns The spectrum band containing the frequency, or undefined if no band contains it
   */
  findBandByFrequency(frequency: number): SpectrumBand | undefined {
    const frequencyHz = Math.round(frequency);
    const channelMatch = this.bands.find((band) => band.channels?.some((channel) => channel.frequency === frequencyHz));

    if (channelMatch) {
      return channelMatch;
    }

    return this.bands.find((band) => frequencyHz >= band.lowerFrequency && frequencyHz <= band.upperFrequency);
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
   * privileges list. FRS is a license-free service, so any band that
   * includes the FRS privilege is allowed for every operator. Frequencies
   * outside every known band return false.
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

    const privileges = band.privileges as string[];

    if (this.frsLicenseClassId && privileges.includes(this.frsLicenseClassId)) {
      return true;
    }

    return privileges.includes(licenseClassId);
  }
}
