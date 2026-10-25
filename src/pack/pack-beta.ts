/**
 * Build one local beta driver zip (ADR 0010).
 *
 * Usage from a radio module repo: `yarn pack:beta <modelId> [n]`
 *   n — positive beta counter (default 1, no leading zero).
 *
 * Writes `dist-release/radio-module-<modelId>-<version>-beta.<n>.zip` without
 * modifying the working tree, catalog entries, or other zips in `dist-release/`.
 * Does not call GitHub and does not skip a model that already has a release asset.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { collectRefClosure } from './ref-closure.js';
import { assertStrictSemver, BETA_COUNTER_PATTERN, packedBetaVersion, parseBetaCounter } from './driver-semver.js';

export {
  assertStrictSemver,
  BETA_COUNTER_PATTERN,
  BETA_VERSION_PATTERN,
  compareDriverVersions,
  compareToCatalogVersion,
  packedBetaVersion,
  parseBetaCounter,
  STRICT_SEMVER_PATTERN,
} from './driver-semver.js';

export const MAX_BETA_ZIP_BYTES = 1024 * 1024;

export interface RadioModuleConfigDescriptor {
  fileName: string;
  relativeConfig: string;
  modelId: string;
  name: string;
  configVersion: string;
  minApiVersion: string;
  manufacturer: string;
  parsed: unknown;
}

export interface PackBetaOptions {
  outputDirectory?: string;
}

export interface PackBetaResult {
  zipPath: string;
  zipName: string;
  modelId: string;
  baseVersion: string;
  packedVersion: string;
  size: number;
  sha256: string;
  gitSha?: string;
}

export function expectedBetaZipName(modelId: string, baseVersion: string, n: number): string {
  return `radio-module-${modelId}-${baseVersion}-beta.${n}.zip`;
}

export function packBetaZip(moduleRoot: string, modelId: string, n = 1, options: PackBetaOptions = {}): PackBetaResult {
  if (!Number.isSafeInteger(n) || !BETA_COUNTER_PATTERN.test(String(n))) {
    throw new Error('beta counter n must be a positive integer with no leading zero');
  }

  const descriptor = loadDescriptor(moduleRoot, modelId);
  validateBetaDescriptor(descriptor);

  const pathsToZip = closurePathsForConfig(moduleRoot, descriptor);
  const version = packedBetaVersion(descriptor.configVersion, n);
  const zipName = expectedBetaZipName(descriptor.modelId, descriptor.configVersion, n);
  const outputDirectory = options.outputDirectory ?? join(moduleRoot, 'dist-release');
  const zipPath = join(outputDirectory, zipName);

  mkdirSync(outputDirectory, { recursive: true });

  const stagingRoot = mkdtempSync(join(tmpdir(), 'pack-beta-'));

  try {
    stageClosureWithBetaVersion(moduleRoot, stagingRoot, pathsToZip, descriptor.relativeConfig, version);
    createZipFromStaging(stagingRoot, zipPath, pathsToZip);
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }

  const size = statSync(zipPath).size;

  if (size > MAX_BETA_ZIP_BYTES) {
    unlinkSync(zipPath);
    throw new Error(`beta zip exceeds ${MAX_BETA_ZIP_BYTES} bytes (${size} bytes)`);
  }

  const sha256 = integrityFromFile(zipPath);
  const gitSha = shortGitSha(moduleRoot);

  return {
    zipPath,
    zipName,
    modelId: descriptor.modelId,
    baseVersion: descriptor.configVersion,
    packedVersion: version,
    size,
    sha256,
    ...(gitSha ? { gitSha } : {}),
  };
}

export function validateBetaDescriptor(descriptor: Pick<RadioModuleConfigDescriptor, 'relativeConfig' | 'configVersion' | 'minApiVersion'>): void {
  const { relativeConfig, configVersion, minApiVersion } = descriptor;

  if (typeof configVersion !== 'string' || configVersion.length === 0) {
    throw new Error(`${relativeConfig} is missing version`);
  }

  if (configVersion.includes('-') || configVersion.includes('+')) {
    throw new Error(`${relativeConfig} version must not include a prerelease or build metadata suffix`);
  }

  assertStrictSemver(configVersion, `${relativeConfig} version`);

  if (typeof minApiVersion !== 'string' || minApiVersion.length === 0) {
    throw new Error(`${relativeConfig} is missing minApiVersion`);
  }

  if (minApiVersion.includes('-') || minApiVersion.includes('+')) {
    throw new Error(`${relativeConfig} minApiVersion must not include a prerelease or build metadata suffix`);
  }

  assertStrictSemver(minApiVersion, `${relativeConfig} minApiVersion`);
}

export function listConfigDescriptors(moduleRoot: string): RadioModuleConfigDescriptor[] {
  const configDirectory = join(moduleRoot, 'configs');

  if (!existsSync(configDirectory)) {
    throw new Error('configs directory is missing');
  }

  const manufacturerDefault = readManufacturerDefault(moduleRoot);

  return readdirSync(configDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => parseConfigDescriptor(moduleRoot, fileName, manufacturerDefault));
}

export function parseConfigDescriptor(moduleRoot: string, fileName: string, manufacturerDefault?: string): RadioModuleConfigDescriptor {
  const relativeConfig = `configs/${fileName}`;
  const absoluteConfig = join(moduleRoot, relativeConfig);
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(absoluteConfig, 'utf8')) as unknown;
  } catch {
    throw new Error(`${relativeConfig} is not valid JSON`);
  }

  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const id = record.id && typeof record.id === 'object' ? (record.id as Record<string, unknown>) : {};
  const modelId = id.model;
  const name = id.name;
  const configVersion = record.version;
  const minApiVersion = record.minApiVersion;
  const manufacturer = typeof id.manufacturer === 'string' && id.manufacturer.length > 0 ? id.manufacturer : manufacturerDefault;

  if (typeof modelId !== 'string' || modelId.length === 0) {
    throw new Error(`${relativeConfig} is missing id.model`);
  }

  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${relativeConfig} is missing id.name`);
  }

  if (typeof configVersion !== 'string' || configVersion.length === 0) {
    throw new Error(`${relativeConfig} is missing version`);
  }

  if (typeof minApiVersion !== 'string' || minApiVersion.length === 0) {
    throw new Error(`${relativeConfig} is missing minApiVersion`);
  }

  if (typeof manufacturer !== 'string' || manufacturer.length === 0) {
    throw new Error(`${relativeConfig} is missing id.manufacturer`);
  }

  const expectedFile = `configs/${modelId}.json`;

  if (relativeConfig !== expectedFile) {
    throw new Error(`${relativeConfig} must be named ${expectedFile} (id.model ${modelId})`);
  }

  return {
    fileName,
    relativeConfig,
    modelId,
    name,
    configVersion,
    minApiVersion,
    manufacturer,
    parsed,
  };
}

export function closurePathsForConfig(moduleRoot: string, descriptor: Pick<RadioModuleConfigDescriptor, 'relativeConfig'>): string[] {
  const paths = collectRefClosure(moduleRoot, descriptor.relativeConfig);

  for (const relativePath of paths) {
    if (!existsSync(join(moduleRoot, relativePath))) {
      throw new Error(`${descriptor.relativeConfig} $ref target is missing: ${relativePath}`);
    }
  }

  return paths;
}

export function stageClosureWithBetaVersion(moduleRoot: string, stagingRoot: string, relativePaths: string[], configRelative: string, version: string): void {
  for (const relativePath of relativePaths) {
    const sourcePath = join(moduleRoot, relativePath);
    const destPath = join(stagingRoot, relativePath);

    mkdirSync(dirname(destPath), { recursive: true });

    if (relativePath === configRelative) {
      const parsed = JSON.parse(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>;
      parsed.version = version;
      writeFileSync(destPath, `${JSON.stringify(parsed, null, 2)}\n`);
    } else {
      cpSync(sourcePath, destPath);
    }
  }
}

export function shortGitSha(moduleRoot: string): string | undefined {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: moduleRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return undefined;
  }

  const sha = result.stdout.trim();
  return sha.length > 0 ? sha : undefined;
}

export function formatBetaPackOutput(result: Pick<PackBetaResult, 'zipPath' | 'size' | 'sha256' | 'gitSha'>): string {
  const lines = [result.zipPath, String(result.size), result.sha256];

  if (result.gitSha) {
    lines.push(result.gitSha);
  }

  return `${lines.join('\n')}\n`;
}

export interface PackBetaCliIo {
  write(chunk: string): void;
}

export function runPackBetaCli(args: readonly string[], moduleRoot: string, stdout: PackBetaCliIo = process.stdout, stderr: PackBetaCliIo = process.stderr): number {
  const [modelId, nArg, ...rest] = args;

  if (!modelId || rest.length > 0) {
    stderr.write('usage: yarn pack:beta <modelId> [n]\n');
    return 1;
  }

  try {
    const n = parseBetaCounter(nArg);
    const result = packBetaZip(moduleRoot, modelId, n);
    stdout.write(formatBetaPackOutput(result));
    return 0;
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function loadDescriptor(moduleRoot: string, modelId: string): RadioModuleConfigDescriptor {
  const descriptors = listConfigDescriptors(moduleRoot);
  const descriptor = descriptors.find((entry) => entry.modelId === modelId);

  if (!descriptor) {
    const known = descriptors.map((entry) => entry.modelId).join(', ');
    throw new Error(`unknown modelId ${modelId}; expected one of: ${known}`);
  }

  return descriptor;
}

function readManufacturerDefault(moduleRoot: string): string | undefined {
  const packagePath = join(moduleRoot, 'package.json');

  if (!existsSync(packagePath)) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as unknown;
  } catch {
    throw new Error('package.json is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  const springfield = (parsed as Record<string, unknown>).springfield;

  if (!springfield || typeof springfield !== 'object') {
    return undefined;
  }

  const manufacturer = (springfield as Record<string, unknown>).manufacturer;
  return typeof manufacturer === 'string' && manufacturer.length > 0 ? manufacturer : undefined;
}

function createZipFromStaging(stagingRoot: string, zipPath: string, relativePaths: string[]): void {
  if (existsSync(zipPath)) {
    unlinkSync(zipPath);
  }

  const zipResult = spawnSync('zip', ['-q', zipPath, ...relativePaths, '-x', '*.DS_Store'], {
    cwd: stagingRoot,
    encoding: 'utf8',
  });

  if (zipResult.status !== 0) {
    throw new Error(zipResult.stderr || zipResult.stdout || 'zip failed');
  }
}

function integrityFromFile(filePath: string): string {
  const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  return `sha256:${hash}`;
}
