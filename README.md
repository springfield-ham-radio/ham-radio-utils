# ham-radio-utils

Shared utilities for HamBench: memory-map codec, band plan, Callook license-class mapping, schema validation, and test helpers.

Docs: [HamBench developer docs](https://springfield-ham-radio.github.io/ham-radio-docs/developer/) · [License lookup](https://springfield-ham-radio.github.io/ham-radio-docs/developer/license-lookup.html) · [Build a beta driver](https://springfield-ham-radio.github.io/ham-radio-docs/developer/beta-driver.html)

## Beta driver zips

`ham-radio-pack-beta` builds one local beta zip from a radio module working tree ([ADR 0010](https://github.com/springfield-ham-radio/ham-radio-docs/blob/main/docs/developer/adr/0010-local-beta-driver-zips.md)). It does not publish a release or write a catalog entry.

From a manufacturer module repo, after this package is installed:

```bash
yarn pack:beta <modelId> [n]
```

`modelId` matches `configs/<modelId>.json`. `n` defaults to `1` (positive integer, no leading zero). The working-tree `version` and `minApiVersion` stay strict `major.minor.patch`. The zip is `dist-release/radio-module-<modelId>-<version>-beta.<n>.zip`, and the config inside the zip uses `<version>-beta.<n>`.

Stdout is the zip path, size in bytes, a `sha256:` digest, and `git rev-parse --short HEAD` when the module tree is a git checkout. A beta of the same `major.minor.patch` as the catalog is older than that catalog release (`compareToCatalogVersion`).

## License

MIT / Bryan Hunt. See [LICENSE](LICENSE).

```bash
corepack enable
yarn install
yarn build
```
