#!/usr/bin/env bash
set -euo pipefail
V=$(<test-corpus/keycloak.version)
DIR=test-corpus/keycloak
TAR="$HOME/.cache/kc-corpus/${V}.tar.gz"
mkdir -p "$(dirname "$TAR")"
if [[ ! -f "$TAR" ]]; then
  echo "⬇️  Downloading Keycloak ${V} …"
  curl -L "https://github.com/keycloak/keycloak/archive/refs/tags/${V}.tar.gz" -o "$TAR"
fi
mkdir -p "$DIR"
tar -C "$DIR" --strip-components=1 -xzf "$TAR"
echo "✅  Corpus ready under $DIR"