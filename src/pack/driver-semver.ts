/**
 * Driver version precedence for local beta zips against a strict catalog version.
 * ADR 0010: registry `compareSemver` stays numeric-only. This helper is the
 * prerelease rule HamBench applies to install directories.
 *
 * - `1.11.1-beta.1` is older than catalog `1.11.1`
 * - `1.11.2-beta.1` is newer than catalog `1.11.1`
 * - among betas, `n` is numeric (`2` is less than `10`)
 */

export const STRICT_SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
export const BETA_COUNTER_PATTERN = /^[1-9]\d*$/;
export const BETA_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)-beta\.([1-9]\d*)$/;

export interface ParsedDriverVersion {
  major: number;
  minor: number;
  patch: number;
  beta?: number;
}

export function assertStrictSemver(value: string, fieldLabel: string): void {
  if (!STRICT_SEMVER_PATTERN.test(value)) {
    throw new Error(`${fieldLabel} must be strict major.minor.patch (no prerelease or build metadata)`);
  }
}

export function parseBetaCounter(raw: string | undefined): number {
  if (raw === undefined) {
    return 1;
  }

  if (!BETA_COUNTER_PATTERN.test(raw)) {
    throw new Error('beta counter n must be a positive integer with no leading zero');
  }

  return Number(raw);
}

export function packedBetaVersion(baseVersion: string, n: number): string {
  return `${baseVersion}-beta.${n}`;
}

export function parseDriverVersion(version: string): ParsedDriverVersion {
  const trimmed = version.trim();
  const betaMatch = BETA_VERSION_PATTERN.exec(trimmed);

  if (betaMatch) {
    return {
      major: Number(betaMatch[1]),
      minor: Number(betaMatch[2]),
      patch: Number(betaMatch[3]),
      beta: Number(betaMatch[4]),
    };
  }

  if (!STRICT_SEMVER_PATTERN.test(trimmed)) {
    throw new Error(`driver version must be strict major.minor.patch or major.minor.patch-beta.n: ${version}`);
  }

  const [major, minor, patch] = trimmed.split('.').map((part) => Number(part));

  return { major: major ?? 0, minor: minor ?? 0, patch: patch ?? 0 };
}

/**
 * Positive when `left` is newer than `right`.
 * A release is newer than a beta of the same major.minor.patch.
 */
export function compareDriverVersions(left: string, right: string): number {
  const a = parseDriverVersion(left);
  const b = parseDriverVersion(right);

  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  if (a.beta === undefined && b.beta === undefined) {
    return 0;
  }

  if (a.beta === undefined) {
    return 1;
  }

  if (b.beta === undefined) {
    return -1;
  }

  return a.beta - b.beta;
}

/**
 * Compare an installed driver version to a catalog `major.minor.patch`.
 * Catalog strings are strict; prerelease catalog versions are rejected.
 * Negative means the install is older than the catalog entry (HamBench offers Update).
 */
export function compareToCatalogVersion(installedVersion: string, catalogVersion: string): number {
  if (!STRICT_SEMVER_PATTERN.test(catalogVersion)) {
    throw new Error(`catalog version must be strict major.minor.patch: ${catalogVersion}`);
  }

  return compareDriverVersions(installedVersion, catalogVersion);
}
