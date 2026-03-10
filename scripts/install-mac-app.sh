#!/usr/bin/env bash

set -euo pipefail

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "This installer currently supports macOS only."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d /tmp/samins-command-center-build.XXXXXX)"
INSTALL_DIR="/Applications"
APP_NAME="Samins Command Center.app"
SHOULD_OPEN=1
SKIP_NPM_INSTALL=0

cleanup() {
  rm -rf "$BUILD_DIR"
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-open)
      SHOULD_OPEN=0
      shift
      ;;
    --skip-npm-install)
      SKIP_NPM_INSTALL=1
      shift
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-open] [--skip-npm-install] [--install-dir /path]"
      exit 1
      ;;
  esac
done

if [[ ! -w "$INSTALL_DIR" ]]; then
  INSTALL_DIR="$HOME/Applications"
  mkdir -p "$INSTALL_DIR"
fi

if [[ "$SKIP_NPM_INSTALL" -eq 0 ]]; then
  echo "Installing root dependencies..."
  (cd "$ROOT_DIR" && npm install)
fi

echo "Preparing temporary build environment..."
ln -s "$ROOT_DIR" "$BUILD_DIR/app"
python3 -m venv "$BUILD_DIR/pyenv"
"$BUILD_DIR/pyenv/bin/pip" install --quiet --upgrade pip setuptools

echo "Clearing previous macOS build output..."
rm -rf "$ROOT_DIR/release/mac" "$ROOT_DIR/release/mac-arm64"

echo "Building local macOS app bundle..."
(
  cd "$BUILD_DIR/app"
  PYTHON="$BUILD_DIR/pyenv/bin/python" npm run electron:build:local
)

APP_SOURCE="$(find "$ROOT_DIR/release" -maxdepth 2 -type d -name "$APP_NAME" -print -quit)"

if [[ -z "$APP_SOURCE" ]]; then
  echo "Build finished but no app bundle was found in $ROOT_DIR/release."
  exit 1
fi

APP_DEST="$INSTALL_DIR/$APP_NAME"

echo "Installing app to $APP_DEST..."
osascript -e 'tell application "Samins Command Center" to quit' >/dev/null 2>&1 || true
rm -rf "$APP_DEST"
ditto "$APP_SOURCE" "$APP_DEST"
xattr -cr "$APP_DEST" || true

if [[ "$SHOULD_OPEN" -eq 1 ]]; then
  echo "Opening Samins Command Center..."
  open "$APP_DEST"
fi

echo "Installed successfully at $APP_DEST"
