#!/usr/bin/env bash
set -euo pipefail
V=$(<test-corpus/keycloak.version)
DIR=test-corpus/keycloak
TAR="$HOME/.cache/kc-corpus/${V}.tar.zst"
mkdir -p "$(dirname "$TAR")"
if [[ ! -f "$TAR" ]]; then
  echo "⬇️  Downloading Keycloak ${V} …"
  curl -L "https://github.com/keycloak/keycloak/archive/refs/tags/${V}.tar.zst" -o "$TAR"
fi
mkdir -p "$DIR"
tar -C "$DIR" --strip-components=1 -xf "$TAR"
echo "✅  Corpus ready under $DIR"
