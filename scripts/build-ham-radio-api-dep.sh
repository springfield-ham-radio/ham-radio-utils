#!/bin/sh
# GitHub-sourced @springfield/ham-radio-api tarballs ship source only (no dist/).
# Build once when dist is missing; no-op for published npm releases.
set -eu

pkg_root="$(cd "$(dirname "$0")/.." && pwd)"
api_pkg="$pkg_root/node_modules/@springfield/ham-radio-api"

if [ -f "$api_pkg/dist/index.js" ]; then
  exit 0
fi

if [ ! -f "$api_pkg/src/index.ts" ]; then
  echo "build-ham-radio-api-dep: @springfield/ham-radio-api is not installed" >&2
  exit 1
fi

ref="${HAM_RADIO_API_GIT_REF:-cursor/channel-bindings-specials-schema}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

git clone --depth 1 --branch "$ref" https://github.com/springfield-ham-radio/ham-radio-api.git "$tmp_dir"

(
  cd "$tmp_dir"
  corepack enable 2>/dev/null || true
  yarn install
  yarn build
)

mkdir -p "$api_pkg/dist"
cp -R "$tmp_dir/dist/." "$api_pkg/dist/"