#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.signing"
RELEASE_DIR="/tmp/dbgrep-release"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy .env.signing.example to .env.signing and add your certificate settings."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT"

# iCloud Desktop adds extended attributes that break macOS codesign.
if [[ "$(uname)" == "Darwin" ]]; then
  for dir in dist dist-electron node_modules/electron/dist/Electron.app; do
    if [[ -e "$ROOT/$dir" ]]; then
      xattr -cr "$ROOT/$dir"
    fi
  done
fi

# Build outside iCloud (e.g. Desktop) so codesign is not broken mid-sign.
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

npm run build -- --config.mac.notarize=true --config.directories.output="$RELEASE_DIR"

mkdir -p "$ROOT/release"
rsync -a --delete "$RELEASE_DIR/" "$ROOT/release/"

echo "Signed release copied to $ROOT/release/"
