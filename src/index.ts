export * from './memory/segmented-memory.js';
export * from './memory/memory-map-codec.js';
export * from './memory/memory-map-channels.js';
export * from './memory/memory-map-ui.js';
export * from './memory/memory-map-radio-codec.js';

export * from './test-utils/radio-channel-factory.js';
export * from './test-utils/radio-programmed-channel-factory.js';

export * from './utils/band-plan.js';
export * from './utils/frequency-display.js';
export * from './utils/memory-channel-utils.js';
export * from './utils/memory-data-utils.js';
export * from './utils/operator-class-mapper.js';
export * from './utils/schema-validator.js';
export * from './utils/to-hex-words.js';
export * from './utils/ui-logger.js';
export * from './utils/ui-logger-factory.js';

export {
  BETA_COUNTER_PATTERN,
  BETA_VERSION_PATTERN,
  MAX_BETA_ZIP_BYTES,
  STRICT_SEMVER_PATTERN,
  assertStrictSemver,
  closurePathsForConfig,
  compareDriverVersions,
  compareToCatalogVersion,
  expectedBetaZipName,
  formatBetaPackOutput,
  listConfigDescriptors,
  packBetaZip,
  packedBetaVersion,
  parseBetaCounter,
  parseConfigDescriptor,
  runPackBetaCli,
  shortGitSha,
  stageClosureWithBetaVersion,
  validateBetaDescriptor,
} from './pack/pack-beta.js';
export type { PackBetaCliIo, PackBetaOptions, PackBetaResult, RadioModuleConfigDescriptor } from './pack/pack-beta.js';

// Export the radio protocol schema
export { default as radioProtocolSchema } from './schemas/radio-protocol-schema.json' with { type: 'json' };
export { default as radioMemoryMapSchema } from './schemas/radio-memory-map-schema.json' with { type: 'json' };
