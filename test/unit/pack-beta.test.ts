import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareDriverVersions,
  compareToCatalogVersion,
  MAX_BETA_ZIP_BYTES,
  closurePathsForConfig,
  expectedBetaZipName,
  formatBetaPackOutput,
  packBetaZip,
  packedBetaVersion,
  parseBetaCounter,
  parseConfigDescriptor,
  runPackBetaCli,
  validateBetaDescriptor,
} from '../../src/pack/pack-beta.js';

function writeModule(options?: { version?: string; minApiVersion?: string; largePayload?: boolean; manufacturerInConfig?: boolean }): string {
  const tempRoot = mkdtempSync(join(tmpdir(), 'pack-beta-'));
  mkdirSync(join(tempRoot, 'configs'), { recursive: true });
  mkdirSync(join(tempRoot, 'src/shared/schemas'), { recursive: true });
  mkdirSync(join(tempRoot, 'src/shared/memory-maps'), { recursive: true });
  writeFileSync(
    join(tempRoot, 'package.json'),
    JSON.stringify({
      name: '@springfield/radio-module-example',
      version: '1.0.0',
      repository: 'https://github.com/springfield-ham-radio/radio-module-example',
      springfield: { manufacturer: 'Example' },
    }),
  );

  const schemaBody = options?.largePayload ? randomBytes(MAX_BETA_ZIP_BYTES + 50_000) : Buffer.from('{"type":"object","$ref":"./nested.json#/$defs/item"}\n');
  writeFileSync(join(tempRoot, 'src/shared/schemas/shared.json'), schemaBody);
  writeFileSync(join(tempRoot, 'src/shared/schemas/nested.json'), '{ "$defs": { "item": { "type": "string" } } }\n');
  writeFileSync(join(tempRoot, 'src/shared/memory-maps/a.json'), '{ "structs": ["a"] }\n');
  writeFileSync(join(tempRoot, 'src/shared/memory-maps/b.json'), '{ "structs": ["b"] }\n');

  const manufacturer = options?.manufacturerInConfig === false ? undefined : 'Example';
  writeFileSync(
    join(tempRoot, 'configs/radio-a.json'),
    configJson('radio-a', 'Radio A', options?.version ?? '1.11.1', options?.minApiVersion ?? '18.0.1', '../src/shared/memory-maps/a.json', manufacturer),
  );
  writeFileSync(join(tempRoot, 'configs/radio-b.json'), configJson('radio-b', 'Radio B', '2.0.0', '18.0.1', '../src/shared/memory-maps/b.json', 'Example'));

  return tempRoot;
}

function configJson(modelId: string, name: string, version: string, minApiVersion: string, mapRef: string, manufacturer: string | undefined): string {
  return `${JSON.stringify(
    {
      id: { model: modelId, name, ...(manufacturer ? { manufacturer } : {}) },
      version,
      minApiVersion,
      description: `${name} driver`,
      memoryMap: { $ref: mapRef },
      channelSchema: { $ref: '../src/shared/schemas/shared.json' },
      ignored: { $ref: '#/description' },
      remote: { $ref: 'https://example.com/schema.json' },
    },
    null,
    2,
  )}\n`;
}

function zipPaths(zipPath: string): string[] {
  const listing = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  expect(listing.status).toBe(0);
  return listing.stdout.trim().split('\n').filter(Boolean).sort();
}

describe('driver semver against the catalog', () => {
  it('should treat a same-base beta as older than the catalog release', () => {
    expect(compareToCatalogVersion('1.11.1-beta.1', '1.11.1')).toBeLessThan(0);
    expect(compareToCatalogVersion('1.11.1', '1.11.1')).toBe(0);
  });

  it('should treat a higher base beta as newer than the catalog release', () => {
    expect(compareToCatalogVersion('1.11.2-beta.1', '1.11.1')).toBeGreaterThan(0);
    expect(compareDriverVersions('1.11.10-beta.1', '1.11.2-beta.9')).toBeGreaterThan(0);
  });

  it('should compare beta counters numerically', () => {
    expect(compareDriverVersions('1.11.2-beta.2', '1.11.2-beta.10')).toBeLessThan(0);
    expect(compareDriverVersions('1.11.2-beta.10', '1.11.2-beta.2')).toBeGreaterThan(0);
    expect(compareDriverVersions('1.0.0-beta.2', '1.0.0-beta.2')).toBe(0);
  });

  it('should reject catalog prereleases and non-canonical beta counters', () => {
    expect(() => compareToCatalogVersion('1.11.2-beta.1', '1.11.1-beta.1')).toThrow(/catalog version/);
    expect(() => compareDriverVersions('1.0.0-beta.01', '1.0.0')).toThrow(/driver version/);
    expect(() => compareDriverVersions('1.0.0-beta.0', '1.0.0')).toThrow(/driver version/);
    expect(() => compareDriverVersions('1.0.0+sha', '1.0.0')).toThrow(/driver version/);
  });
});

describe('pack:beta', () => {
  it('should parse beta counter n', () => {
    expect(parseBetaCounter(undefined)).toBe(1);
    expect(parseBetaCounter('2')).toBe(2);
    expect(parseBetaCounter('10')).toBe(10);
    expect(() => parseBetaCounter('0')).toThrow(/positive integer/);
    expect(() => parseBetaCounter('01')).toThrow(/leading zero/);
    expect(() => parseBetaCounter('-1')).toThrow(/positive integer/);
    expect(() => parseBetaCounter('1.5')).toThrow(/positive integer/);
  });

  it('should pack one beta zip and leave the working tree unchanged', () => {
    const moduleRoot = writeModule();
    const configPath = join(moduleRoot, 'configs/radio-a.json');
    const before = readFileSync(configPath, 'utf8');
    const outputDirectory = mkdtempSync(join(tmpdir(), 'pack-beta-out-'));
    const keeperPath = join(outputDirectory, 'radio-module-radio-a-1.11.1.zip');
    writeFileSync(keeperPath, 'placeholder');
    writeFileSync(join(outputDirectory, 'catalog-entries.json'), '{"keep":true}\n');

    try {
      const descriptor = parseConfigDescriptor(moduleRoot, 'radio-a.json', 'Example');
      const result = packBetaZip(moduleRoot, 'radio-a', 1, { outputDirectory });

      expect(result.zipName).toBe(expectedBetaZipName('radio-a', '1.11.1', 1));
      expect(result.packedVersion).toBe(packedBetaVersion('1.11.1', 1));
      expect(result.baseVersion).toBe('1.11.1');
      expect(result.size).toBeLessThanOrEqual(MAX_BETA_ZIP_BYTES);
      expect(readFileSync(configPath, 'utf8')).toBe(before);
      expect(readFileSync(keeperPath, 'utf8')).toBe('placeholder');
      expect(readFileSync(join(outputDirectory, 'catalog-entries.json'), 'utf8')).toBe('{"keep":true}\n');
      expect(existsSync(join(outputDirectory, 'radio-module-radio-b-2.0.0-beta.1.zip'))).toBe(false);

      const releasePaths = closurePathsForConfig(moduleRoot, descriptor);
      expect(releasePaths).toEqual(['configs/radio-a.json', 'src/shared/memory-maps/a.json', 'src/shared/schemas/nested.json', 'src/shared/schemas/shared.json']);
      expect(zipPaths(result.zipPath)).toEqual(releasePaths);
      expect(zipPaths(result.zipPath)).not.toContain('configs/radio-b.json');
      expect(zipPaths(result.zipPath)).not.toContain('src/shared/memory-maps/b.json');

      const extracted = spawnSync('unzip', ['-p', result.zipPath, 'configs/radio-a.json'], { encoding: 'utf8' });
      expect(extracted.status).toBe(0);
      const packedConfig = JSON.parse(extracted.stdout) as { version: string; description: string; memoryMap: { $ref: string } };
      expect(packedConfig.version).toBe('1.11.1-beta.1');
      expect(packedConfig.description).toBe('Radio A driver');
      expect(packedConfig.memoryMap.$ref).toBe('../src/shared/memory-maps/a.json');

      const shared = spawnSync('unzip', ['-p', result.zipPath, 'src/shared/schemas/shared.json'], { encoding: 'utf8' });
      expect(shared.stdout).toBe(readFileSync(join(moduleRoot, 'src/shared/schemas/shared.json'), 'utf8'));

      const hash = createHash('sha256').update(readFileSync(result.zipPath)).digest('hex');
      expect(result.sha256).toBe(`sha256:${hash}`);
      expect(formatBetaPackOutput(result)).toBe(`${result.zipPath}\n${result.size}\n${result.sha256}\n`);
      expect(compareToCatalogVersion(result.packedVersion, result.baseVersion)).toBeLessThan(0);
      expect(compareToCatalogVersion(packedBetaVersion('1.11.2', 1), '1.11.1')).toBeGreaterThan(0);
      expect(() => validateBetaDescriptor(descriptor)).not.toThrow();
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('should use the beta counter in the file name and include the git sha', () => {
    const moduleRoot = writeModule();
    const outputDirectory = mkdtempSync(join(tmpdir(), 'pack-beta-out-'));

    try {
      git(moduleRoot, ['init', '-q']);
      git(moduleRoot, ['config', 'user.email', 'dev@example.com']);
      git(moduleRoot, ['config', 'user.name', 'Dev']);
      git(moduleRoot, ['add', '-A']);
      git(moduleRoot, ['commit', '-q', '-m', 'init']);
      const expectedSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: moduleRoot, encoding: 'utf8' }).stdout.trim();

      const result = packBetaZip(moduleRoot, 'radio-a', 2, { outputDirectory });
      expect(result.zipName).toBe('radio-module-radio-a-1.11.1-beta.2.zip');
      expect(result.gitSha).toBe(expectedSha);
      expect(formatBetaPackOutput(result)).toBe(`${result.zipPath}\n${result.size}\n${result.sha256}\n${expectedSha}\n`);
      expect(readFileSync(join(moduleRoot, 'configs/radio-a.json'), 'utf8')).toContain('"version": "1.11.1"');
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('should fall back to package.json manufacturer', () => {
    const moduleRoot = writeModule({ manufacturerInConfig: false });

    try {
      const result = packBetaZip(moduleRoot, 'radio-a', 1, { outputDirectory: mkdtempSync(join(tmpdir(), 'pack-beta-out-')) });
      expect(result.modelId).toBe('radio-a');
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
    }
  });

  it('should reject working-tree prerelease versions and build metadata', () => {
    const moduleRoot = writeModule({ version: '1.11.1-beta.1' });

    try {
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/prerelease/);
      writeFileSync(join(moduleRoot, 'configs/radio-a.json'), configJson('radio-a', 'Radio A', '1.11.1+sha', '18.0.1', '../src/shared/memory-maps/a.json', 'Example'));
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/build metadata/);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
    }
  });

  it('should require strict major.minor.patch minApiVersion', () => {
    const moduleRoot = writeModule({ minApiVersion: '18' });

    try {
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/minApiVersion/);
      writeFileSync(join(moduleRoot, 'configs/radio-a.json'), configJson('radio-a', 'Radio A', '1.11.1', '18.0.1-beta.1', '../src/shared/memory-maps/a.json', 'Example'));
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/minApiVersion/);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
    }
  });

  it('should delete an oversized zip and leave no beta artifact', () => {
    const moduleRoot = writeModule({ largePayload: true });
    const outputDirectory = mkdtempSync(join(tmpdir(), 'pack-beta-out-'));

    try {
      expect(() => packBetaZip(moduleRoot, 'radio-a', 1, { outputDirectory })).toThrow(/exceeds/);
      expect(existsSync(join(outputDirectory, expectedBetaZipName('radio-a', '1.11.1', 1)))).toBe(false);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('should fail when a $ref escapes the repo or the target is missing', () => {
    const moduleRoot = writeModule();

    try {
      writeFileSync(join(moduleRoot, 'configs/radio-a.json'), configJson('radio-a', 'Radio A', '1.11.1', '18.0.1', '../../outside.json', 'Example'));
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/escapes the repository/);

      writeFileSync(join(moduleRoot, 'configs/radio-a.json'), configJson('radio-a', 'Radio A', '1.11.1', '18.0.1', '../src/shared/memory-maps/missing.json', 'Example'));
      expect(() => packBetaZip(moduleRoot, 'radio-a')).toThrow(/\$ref target is missing/);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
    }
  });

  it('should reject an unknown model and a bad counter without writing a zip', () => {
    const moduleRoot = writeModule();
    const outputDirectory = mkdtempSync(join(tmpdir(), 'pack-beta-out-'));

    try {
      expect(() => packBetaZip(moduleRoot, 'missing-radio', 1, { outputDirectory })).toThrow(/unknown modelId missing-radio/);
      expect(() => packBetaZip(moduleRoot, 'radio-a', 0, { outputDirectory })).toThrow(/positive integer/);
      expect(existsSync(join(moduleRoot, 'dist-release'))).toBe(false);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('should run the CLI used by yarn pack:beta', () => {
    const moduleRoot = writeModule();
    const stdout: string[] = [];
    const stderr: string[] = [];

    try {
      const code = runPackBetaCli(['radio-b', '3'], moduleRoot, { write: (chunk) => stdout.push(chunk) }, { write: (chunk) => stderr.push(chunk) });
      expect(code).toBe(0);
      expect(stderr).toEqual([]);
      const text = stdout.join('');
      expect(text).toContain(`radio-module-radio-b-2.0.0-beta.3.zip`);
      expect(text).toContain('sha256:');

      const usage: string[] = [];
      expect(runPackBetaCli([], moduleRoot, { write: () => undefined }, { write: (chunk) => usage.push(chunk) })).toBe(1);
      expect(usage.join('')).toContain('usage: yarn pack:beta <modelId> [n]');
      expect(runPackBetaCli(['radio-b', '01'], moduleRoot, { write: () => undefined }, { write: () => undefined })).toBe(1);
      expect(runPackBetaCli(['radio-b', '3', 'extra'], moduleRoot, { write: () => undefined }, { write: () => undefined })).toBe(1);
    } finally {
      rmSync(moduleRoot, { recursive: true, force: true });
      rmSync(join(moduleRoot, 'dist-release'), { recursive: true, force: true });
    }
  });
});

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}
